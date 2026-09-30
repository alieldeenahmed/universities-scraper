import { MAX_GAP_ATTEMPTS, type Gap, type GapKind, type GapObservation } from "../../domain/gap";
import type { GapCounts, GapRepository } from "../../domain/ports/repositories";
import type { Database, Queryable, Row } from "../db/database";

function toGap(row: Row): Gap {
  return {
    id: row.id,
    universityId: row.university_id,
    majorExternalId: row.major_external_id,
    majorName: row.major_name,
    kind: row.kind,
    field: row.field,
    detail: row.detail,
    status: row.status,
    attempts: row.attempts,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    resolvedAt: row.resolved_at,
  };
}

const keyOf = (kind: string, field: string | null) => `${kind}:${field ?? ""}`;

export class PostgresGapRepository implements GapRepository {
  constructor(private readonly db: Database) {}

  syncForMajor(
    universityId: number,
    externalId: string,
    majorName: string,
    observed: GapObservation[],
    now: Date,
  ): Promise<void> {
    return this.db.transaction((tx) => this.sync(tx, universityId, externalId, majorName, observed, null, now));
  }

  syncForUniversity(
    universityId: number,
    kinds: GapKind[],
    observed: GapObservation[],
    now: Date,
  ): Promise<void> {
    return this.db.transaction((tx) => this.sync(tx, universityId, null, null, observed, kinds, now));
  }

  async listUnresolved(options: { universityId?: number } = {}): Promise<Gap[]> {
    const params: unknown[] = [];
    let scope = "";
    if (options.universityId != null) {
      params.push(options.universityId);
      scope = "and university_id = $1";
    }
    const { rows } = await this.db.query(
      `select * from crawl_gaps where status <> 'resolved' ${scope}
       order by university_id, major_name nulls first, id`,
      params,
    );
    return rows.map(toGap);
  }

  async repairTargets(universityId: number): Promise<string[]> {
    const { rows } = await this.db.query(
      `select distinct major_external_id from crawl_gaps
       where university_id = $1 and status = 'open' and major_external_id is not null
       order by major_external_id`,
      [universityId],
    );
    return rows.map((r) => r.major_external_id);
  }

  async maxOpenAttempts(universityId: number): Promise<number> {
    const { rows } = await this.db.query(
      "select coalesce(max(attempts), 0)::int as n from crawl_gaps where university_id = $1 and status = 'open'",
      [universityId],
    );
    return rows[0]?.n ?? 0;
  }

  async counts(universityId: number): Promise<GapCounts> {
    const { rows } = await this.db.query(
      `select
         count(*) filter (where status = 'open')::int as open,
         count(*) filter (where status = 'gave_up')::int as gave_up
       from crawl_gaps where university_id = $1`,
      [universityId],
    );
    return { open: rows[0]?.open ?? 0, gaveUp: rows[0]?.gave_up ?? 0 };
  }

  /**
   * `resolveKinds` limits which existing gaps may be resolved. Null means every
   * unresolved gap of the major (the whole major was just looked at).
   */
  private async sync(
    tx: Queryable,
    universityId: number,
    externalId: string | null,
    majorName: string | null,
    observed: GapObservation[],
    resolveKinds: GapKind[] | null,
    now: Date,
  ): Promise<void> {
    const existing = await tx.query(
      `select * from crawl_gaps
       where university_id = $1 and status <> 'resolved'
         and major_external_id is not distinct from $2`,
      [universityId, externalId],
    );
    const byKey = new Map(existing.rows.map((r) => [keyOf(r.kind, r.field), r]));
    const seen = new Set<string>();

    for (const gap of observed) {
      const key = keyOf(gap.kind, gap.field);
      seen.add(key);
      const current = byKey.get(key);

      if (!current) {
        await tx.query(
          `insert into crawl_gaps
             (university_id, major_external_id, major_name, kind, field, detail, status, attempts, first_seen_at, last_seen_at)
           values ($1, $2, $3, $4, $5, $6, 'open', 1, $7, $7)`,
          [universityId, externalId, majorName, gap.kind, gap.field, gap.detail, now],
        );
        continue;
      }

      const attempts = current.attempts + 1;
      const status = current.status === "gave_up" || attempts >= MAX_GAP_ATTEMPTS ? "gave_up" : "open";
      await tx.query(
        `update crawl_gaps set detail = $2, attempts = $3, status = $4, last_seen_at = $5, major_name = coalesce($6, major_name)
         where id = $1`,
        [current.id, gap.detail, attempts, status, now, majorName],
      );
    }

    for (const row of existing.rows) {
      if (seen.has(keyOf(row.kind, row.field))) continue;
      if (resolveKinds && !resolveKinds.includes(row.kind)) continue;
      await tx.query("update crawl_gaps set status = 'resolved', resolved_at = $2 where id = $1", [row.id, now]);
    }
  }
}
