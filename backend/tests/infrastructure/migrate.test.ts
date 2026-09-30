import { describe, expect, it } from "vitest";
import { migrate } from "../../src/infrastructure/db/migrate";
import { PgliteDatabase } from "../../src/infrastructure/db/pglite-database";

describe("migrate", () => {
  it("creates the schema and only runs each file once", async () => {
    const db = new PgliteDatabase();

    const first = await migrate(db);
    expect(first).toEqual(["001_initial.sql"]);

    const second = await migrate(db);
    expect(second).toEqual([]);

    const tables = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    const names = tables.rows.map((r) => r.table_name);
    expect(names).toEqual(
      expect.arrayContaining(["universities", "faculties", "departments", "majors", "crawl_runs", "crawl_gaps"]),
    );
    await db.close();
  });
});
