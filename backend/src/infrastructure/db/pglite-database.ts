import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Database, Queryable, QueryResult, Row } from "./database";

/**
 * Embedded Postgres, runs inside the node process. Used for local runs with no
 * DATABASE_URL and for the tests. Pass no path for an in-memory database.
 */
export class PgliteDatabase implements Database {
  private readonly db: PGlite;

  constructor(dataDir?: string) {
    if (dataDir) mkdirSync(dataDir, { recursive: true });
    this.db = dataDir ? new PGlite(dataDir) : new PGlite();
  }

  async query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.db.query<T>(text, params);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  }

  async exec(text: string): Promise<void> {
    await this.db.exec(text);
  }

  async transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      const adapter: Queryable = {
        async query<R extends Row = Row>(text: string, params: unknown[] = []) {
          const result = await tx.query<R>(text, params);
          return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
        },
      };
      return work(adapter);
    });
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
