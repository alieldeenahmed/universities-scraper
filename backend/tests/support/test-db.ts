import { migrate } from "../../src/infrastructure/db/migrate";
import { PgliteDatabase } from "../../src/infrastructure/db/pglite-database";

/** A fresh in-memory Postgres with the schema applied. */
export async function createTestDb(): Promise<PgliteDatabase> {
  const db = new PgliteDatabase();
  await migrate(db);
  return db;
}
