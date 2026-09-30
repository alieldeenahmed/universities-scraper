import { emptyStats, type CrawlRun } from "../../domain/crawl";
import type { CrawlRequest, CrawlResult, CrawlRunRepository } from "../../domain/ports/repositories";
import type { Database, Row } from "../db/database";

function toRun(row: Row): CrawlRun {
  return {
    id: row.id,
    universityId: row.university_id,
    mode: row.mode,
    trigger: row.trigger,
    status: row.status,
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    progressDone: row.progress_done,
    progressTotal: row.progress_total,
    stats: { ...emptyStats(), ...(row.stats ?? {}) },
    failure: row.failure,
  };
}

export class PostgresCrawlRunRepository implements CrawlRunRepository {
  constructor(private readonly db: Database) {}

  async request(req: CrawlRequest, now: Date): Promise<{ run: CrawlRun; created: boolean }> {
    const inserted = await this.db.query(
      `insert into crawl_runs (university_id, mode, trigger, status, requested_at)
       values ($1, $2, $3, 'pending', $4)
       on conflict (university_id) where status in ('pending', 'running') do nothing
       returning *`,
      [req.universityId, req.mode, req.trigger, now],
    );
    if (inserted.rows[0]) return { run: toRun(inserted.rows[0]), created: true };

    const active = await this.findActive(req.universityId);
    if (!active) {
      // the active run finished between the insert and the lookup, just try once more
      return this.request(req, now);
    }
    return { run: active, created: false };
  }

  async claimNext(now: Date): Promise<CrawlRun | null> {
    const { rows } = await this.db.query(
      `update crawl_runs set status = 'running', started_at = $1
       where id = (
         select id from crawl_runs where status = 'pending' order by id limit 1 for update skip locked
       )
       returning *`,
      [now],
    );
    return rows[0] ? toRun(rows[0]) : null;
  }

  async setProgress(id: number, done: number, total: number): Promise<void> {
    await this.db.query("update crawl_runs set progress_done = $2, progress_total = $3 where id = $1", [
      id,
      done,
      total,
    ]);
  }

  async finish(id: number, result: CrawlResult, now: Date): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `update crawl_runs set status = $2, stats = $3, failure = $4, finished_at = $5
       where id = $1 and status = 'running'`,
      [id, result.status, JSON.stringify(result.stats), result.failure ? JSON.stringify(result.failure) : null, now],
    );
    return rowCount > 0;
  }

  async expireStale(now: Date, pendingOlderThanMs: number, runningOlderThanMs: number): Promise<number> {
    const pendingCutoff = new Date(now.getTime() - pendingOlderThanMs);
    const runningCutoff = new Date(now.getTime() - runningOlderThanMs);

    const pending = await this.db.query(
      `update crawl_runs set status = 'expired', finished_at = $1,
         failure = '{"stage":"timeout","message":"nobody picked this crawl up in time"}'::jsonb
       where status = 'pending' and requested_at < $2`,
      [now, pendingCutoff],
    );
    const running = await this.db.query(
      `update crawl_runs set status = 'failed', finished_at = $1,
         failure = '{"stage":"timeout","message":"crawl ran for too long and was given up on"}'::jsonb
       where status = 'running' and started_at < $2`,
      [now, runningCutoff],
    );
    return pending.rowCount + running.rowCount;
  }

  async failInterrupted(now: Date): Promise<number> {
    const { rowCount } = await this.db.query(
      `update crawl_runs set status = 'failed', finished_at = $1,
         failure = '{"stage":"interrupted","message":"the app stopped while this crawl was running"}'::jsonb
       where status = 'running'`,
      [now],
    );
    return rowCount;
  }

  async get(id: number): Promise<CrawlRun | null> {
    const { rows } = await this.db.query("select * from crawl_runs where id = $1", [id]);
    return rows[0] ? toRun(rows[0]) : null;
  }

  async listRecent(options: { universityId?: number; limit: number }): Promise<CrawlRun[]> {
    const params: unknown[] = [options.limit];
    let where = "";
    if (options.universityId != null) {
      params.push(options.universityId);
      where = "where university_id = $2";
    }
    const { rows } = await this.db.query(`select * from crawl_runs ${where} order by id desc limit $1`, params);
    return rows.map(toRun);
  }

  async findActive(universityId: number): Promise<CrawlRun | null> {
    const { rows } = await this.db.query(
      "select * from crawl_runs where university_id = $1 and status in ('pending', 'running')",
      [universityId],
    );
    return rows[0] ? toRun(rows[0]) : null;
  }

  async lastSuccessful(universityId: number): Promise<CrawlRun | null> {
    return this.latest(universityId, "status in ('completed', 'completed_with_issues')");
  }

  async lastFinished(universityId: number): Promise<CrawlRun | null> {
    return this.latest(universityId, "finished_at is not null and status <> 'expired'");
  }

  async lastRepair(universityId: number): Promise<CrawlRun | null> {
    return this.latest(universityId, "trigger = 'repair'");
  }

  private async latest(universityId: number, condition: string): Promise<CrawlRun | null> {
    const { rows } = await this.db.query(
      `select * from crawl_runs where university_id = $1 and ${condition} order by id desc limit 1`,
      [universityId],
    );
    return rows[0] ? toRun(rows[0]) : null;
  }
}
