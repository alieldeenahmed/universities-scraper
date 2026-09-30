import { createHash } from "node:crypto";
import type { Major } from "../../domain/major";
import type {
  MajorFacets,
  MajorFilter,
  MajorRepository,
  UpsertOutcome,
} from "../../domain/ports/repositories";
import type { ScrapedMajor } from "../../domain/scraped-major";
import type { Database, Queryable, Row } from "../db/database";

const SELECT_MAJOR = `
  select m.*, f.name as faculty_name, d.name as department_name
  from majors m
  left join faculties f on f.id = m.faculty_id
  left join departments d on d.id = m.department_id
`;

function toMajor(row: Row): Major {
  return {
    id: row.id,
    universityId: row.university_id,
    externalId: row.external_id,
    name: row.name,
    degreeType: row.degree_type,
    faculty: row.faculty_name,
    department: row.department_name,
    description: row.description,
    creditHours: row.credit_hours,
    admissionRequirements: row.admission_requirements,
    tuition: row.tuition,
    sourceUrl: row.source_url,
    sourceVersion: row.source_version,
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastChangedAt: row.last_changed_at,
  };
}

/** Only the parts that matter to a reader. A changed version or a warning alone is not a content change. */
function hashContent(m: ScrapedMajor): string {
  const content = {
    name: m.name,
    degreeType: m.degreeType,
    faculty: m.faculty,
    department: m.department,
    description: m.description,
    creditHours: m.creditHours,
    admissionRequirements: m.admissionRequirements,
    tuition: m.tuition,
    sourceUrl: m.sourceUrl,
  };
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export class PostgresMajorRepository implements MajorRepository {
  constructor(private readonly db: Database) {}

  async save(universityId: number, scraped: ScrapedMajor, now: Date): Promise<UpsertOutcome> {
    return this.db.transaction(async (tx) => {
      const facultyId = scraped.faculty ? await this.upsertFaculty(tx, universityId, scraped.faculty) : null;
      const departmentId = scraped.department
        ? await this.upsertDepartment(tx, universityId, facultyId, scraped.department)
        : null;
      const hash = hashContent(scraped);

      const existing = await tx.query(
        "select id, content_hash, status from majors where university_id = $1 and external_id = $2",
        [universityId, scraped.externalId],
      );
      const current = existing.rows[0];

      if (!current) {
        await tx.query(
          `insert into majors (
             university_id, external_id, name, degree_type, faculty_id, department_id,
             description, credit_hours, admission_requirements, tuition, source_url,
             source_version, content_hash, status, first_seen_at, last_seen_at, last_changed_at
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',$14,$14,$14)`,
          [
            universityId,
            scraped.externalId,
            scraped.name,
            scraped.degreeType,
            facultyId,
            departmentId,
            scraped.description,
            scraped.creditHours,
            scraped.admissionRequirements ? JSON.stringify(scraped.admissionRequirements) : null,
            scraped.tuition ? JSON.stringify(scraped.tuition) : null,
            scraped.sourceUrl,
            scraped.sourceVersion,
            hash,
            now,
          ],
        );
        return "created";
      }

      const unchanged = current.content_hash === hash && current.status === "active";
      if (unchanged) {
        await tx.query("update majors set last_seen_at = $2, source_version = $3 where id = $1", [
          current.id,
          now,
          scraped.sourceVersion,
        ]);
        return "unchanged";
      }

      await tx.query(
        `update majors set
           name = $2, degree_type = $3, faculty_id = $4, department_id = $5,
           description = $6, credit_hours = $7, admission_requirements = $8, tuition = $9,
           source_url = $10, source_version = $11, content_hash = $12,
           status = 'active', last_seen_at = $13, last_changed_at = $13
         where id = $1`,
        [
          current.id,
          scraped.name,
          scraped.degreeType,
          facultyId,
          departmentId,
          scraped.description,
          scraped.creditHours,
          scraped.admissionRequirements ? JSON.stringify(scraped.admissionRequirements) : null,
          scraped.tuition ? JSON.stringify(scraped.tuition) : null,
          scraped.sourceUrl,
          scraped.sourceVersion,
          hash,
          now,
        ],
      );
      return "updated";
    });
  }

  async markSeen(universityId: number, externalId: string, now: Date): Promise<void> {
    await this.db.query(
      "update majors set last_seen_at = $3 where university_id = $1 and external_id = $2",
      [universityId, externalId, now],
    );
  }

  async sourceVersions(universityId: number): Promise<Map<string, string | null>> {
    const { rows } = await this.db.query(
      "select external_id, source_version from majors where university_id = $1 and status = 'active'",
      [universityId],
    );
    return new Map(rows.map((r) => [r.external_id as string, r.source_version as string | null]));
  }

  async markMissingExcept(universityId: number, seen: string[], now: Date): Promise<number> {
    const result = await this.db.query(
      `update majors set status = 'missing', last_changed_at = $3
       where university_id = $1 and status = 'active' and not (external_id = any($2::text[]))`,
      [universityId, seen, now],
    );
    return result.rowCount;
  }

  async list(filter: MajorFilter): Promise<Major[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where.push(clause.replace("?", `$${params.length}`));
    };

    if (filter.universityId != null) add("m.university_id = ?", filter.universityId);
    if (filter.status) add("m.status = ?", filter.status);
    if (filter.faculty) add("f.name = ?", filter.faculty);
    if (filter.department) add("d.name = ?", filter.department);
    if (filter.degreeType) add("m.degree_type = ?", filter.degreeType);
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const p = `$${params.length}`;
      where.push(`(m.name ilike ${p} or m.description ilike ${p} or d.name ilike ${p} or f.name ilike ${p})`);
    }

    const sql = `${SELECT_MAJOR} ${where.length ? "where " + where.join(" and ") : ""} order by f.name nulls last, m.name`;
    const { rows } = await this.db.query(sql, params);
    return rows.map(toMajor);
  }

  async findById(id: number): Promise<Major | null> {
    const { rows } = await this.db.query(`${SELECT_MAJOR} where m.id = $1`, [id]);
    return rows[0] ? toMajor(rows[0]) : null;
  }

  async facets(universityId?: number): Promise<MajorFacets> {
    const params: unknown[] = [];
    let scope = "";
    if (universityId != null) {
      params.push(universityId);
      scope = "and m.university_id = $1";
    }

    const faculties = await this.db.query(
      `select f.name as faculty,
              coalesce(array_agg(distinct d.name order by d.name) filter (where d.name is not null), '{}') as departments
       from majors m
       join faculties f on f.id = m.faculty_id
       left join departments d on d.id = m.department_id
       where m.status = 'active' ${scope}
       group by f.name
       order by f.name`,
      params,
    );
    const degrees = await this.db.query(
      `select distinct m.degree_type from majors m
       where m.status = 'active' and m.degree_type is not null ${scope}
       order by m.degree_type`,
      params,
    );

    return {
      faculties: faculties.rows.map((r) => ({ name: r.faculty, departments: r.departments })),
      degreeTypes: degrees.rows.map((r) => r.degree_type),
    };
  }

  async count(universityId: number, status: "active" | "missing"): Promise<number> {
    const { rows } = await this.db.query(
      "select count(*)::int as n from majors where university_id = $1 and status = $2",
      [universityId, status],
    );
    return rows[0]?.n ?? 0;
  }

  private async upsertFaculty(tx: Queryable, universityId: number, name: string): Promise<number> {
    const { rows } = await tx.query(
      `insert into faculties (university_id, name) values ($1, $2)
       on conflict (university_id, name) do update set name = excluded.name
       returning id`,
      [universityId, name],
    );
    return rows[0]!.id;
  }

  private async upsertDepartment(
    tx: Queryable,
    universityId: number,
    facultyId: number | null,
    name: string,
  ): Promise<number> {
    const { rows } = await tx.query(
      `insert into departments (university_id, faculty_id, name) values ($1, $2, $3)
       on conflict (university_id, name) do update set faculty_id = coalesce(excluded.faculty_id, departments.faculty_id)
       returning id`,
      [universityId, facultyId, name],
    );
    return rows[0]!.id;
  }
}
