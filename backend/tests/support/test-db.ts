import { migrate } from "../../src/infrastructure/db/migrate";
import { PgliteDatabase } from "../../src/infrastructure/db/pglite-database";

// Booting pglite takes a few seconds, so each test file shares one instance
// and just empties the tables between tests.
let shared: Promise<PgliteDatabase> | null = null;

async function boot(): Promise<PgliteDatabase> {
  const db = new PgliteDatabase();
  await migrate(db);
  return db;
}

/** A clean database with the schema applied. Don't close it, the next test reuses it. */
export async function createTestDb(): Promise<PgliteDatabase> {
  shared ??= boot();
  const db = await shared;
  await db.exec(
    "truncate table crawl_gaps, crawl_runs, majors, departments, faculties, universities restart identity cascade",
  );
  return db;
}
