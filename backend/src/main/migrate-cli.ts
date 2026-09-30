import { migrate } from "../infrastructure/db/migrate";
import { PgDatabase } from "../infrastructure/db/pg-database";
import { PgliteDatabase } from "../infrastructure/db/pglite-database";
import { ConsoleLogger } from "../infrastructure/system/console-logger";
import { loadConfig } from "./config";
import { loadEnvFile } from "./load-env";

async function main() {
  loadEnvFile();
  const config = loadConfig();
  const logger = new ConsoleLogger(config.LOG_LEVEL);
  const db = config.DATABASE_URL ? new PgDatabase(config.DATABASE_URL) : new PgliteDatabase(config.DATA_DIR);

  try {
    const applied = await migrate(db, logger);
    logger.info(applied.length === 0 ? "already up to date" : `applied ${applied.length} migration(s)`);
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
