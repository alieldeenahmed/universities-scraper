import type { UniversityRepository } from "../../domain/ports/repositories";
import type { University, UniversityInfo } from "../../domain/university";
import type { Database, Row } from "../db/database";

function toUniversity(row: Row): University {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    country: row.country,
    website: row.website,
    schedule: { everyHours: row.schedule_every_hours },
  };
}

export class PostgresUniversityRepository implements UniversityRepository {
  constructor(private readonly db: Database) {}

  async sync(infos: UniversityInfo[]): Promise<University[]> {
    for (const info of infos) {
      await this.db.query(
        `insert into universities (slug, name, country, website, schedule_every_hours)
         values ($1, $2, $3, $4, $5)
         on conflict (slug) do update set
           name = excluded.name,
           country = excluded.country,
           website = excluded.website,
           schedule_every_hours = excluded.schedule_every_hours`,
        [info.slug, info.name, info.country, info.website, info.schedule.everyHours],
      );
    }
    return this.list();
  }

  async list(): Promise<University[]> {
    const { rows } = await this.db.query("select * from universities order by name");
    return rows.map(toUniversity);
  }

  async findById(id: number): Promise<University | null> {
    const { rows } = await this.db.query("select * from universities where id = $1", [id]);
    return rows[0] ? toUniversity(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<University | null> {
    const { rows } = await this.db.query("select * from universities where slug = $1", [slug]);
    return rows[0] ? toUniversity(rows[0]) : null;
  }
}
