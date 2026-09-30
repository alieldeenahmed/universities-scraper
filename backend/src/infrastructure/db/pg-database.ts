import pg from "pg";
import type { Database, Queryable, QueryResult, Row } from "./database";

export class PgDatabase implements Database {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      max: 5,
      // neon closes idle connections on its side, don't hold on to them for long
      idleTimeoutMillis: 10_000,
    });
  }

  async query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.pool.query(text, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }

  async exec(text: string): Promise<void> {
    await this.pool.query(text);
  }

  async transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const tx: Queryable = {
      async query<R extends Row = Row>(text: string, params: unknown[] = []) {
        const result = await client.query(text, params);
        return { rows: result.rows as R[], rowCount: result.rowCount ?? 0 };
      },
    };
    try {
      await client.query("begin");
      const value = await work(tx);
      await client.query("commit");
      return value;
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
