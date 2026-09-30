import { CatalogQueries } from "../application/catalog-queries";
import { CrawlUniversity } from "../application/crawl-university";
import { CrawlWorker } from "../application/crawl-worker";
import { RequestCrawl } from "../application/request-crawl";
import { ScheduleCrawls } from "../application/schedule-crawls";
import type { Database } from "../infrastructure/db/database";
import { migrate } from "../infrastructure/db/migrate";
import { PgDatabase } from "../infrastructure/db/pg-database";
import { PgliteDatabase } from "../infrastructure/db/pglite-database";
import { PoliteHttpClient } from "../infrastructure/http/polite-http-client";
import { PostgresCrawlRunRepository } from "../infrastructure/repositories/crawl-run-repository";
import { PostgresGapRepository } from "../infrastructure/repositories/gap-repository";
import { PostgresMajorRepository } from "../infrastructure/repositories/major-repository";
import { PostgresUniversityRepository } from "../infrastructure/repositories/university-repository";
import { ConsoleLogger } from "../infrastructure/system/console-logger";
import { createSleepBlocker } from "../infrastructure/system/sleep-blocker";
import { SystemClock } from "../infrastructure/system/system-clock";
import { StaticUniversityRegistry } from "../infrastructure/universities/registry";
import type { Config } from "./config";

/** Builds every object the app needs and connects them. The only place that knows which implementation is used. */
export async function createContainer(config: Config) {
  const logger = new ConsoleLogger(config.LOG_LEVEL);

  let db: Database;
  if (config.DATABASE_URL) {
    db = new PgDatabase(config.DATABASE_URL);
    logger.info("using postgres from DATABASE_URL");
  } else {
    db = new PgliteDatabase(config.DATA_DIR);
    logger.info("using the embedded database", { dir: config.DATA_DIR });
  }
  await migrate(db, logger);

  const clock = new SystemClock();
  const http = new PoliteHttpClient({
    userAgent: config.USER_AGENT,
    minDelayMs: config.HTTP_MIN_DELAY_MS,
    logger,
  });
  const registry = new StaticUniversityRegistry({ http, logger });

  const universities = new PostgresUniversityRepository(db);
  const majors = new PostgresMajorRepository(db);
  const runs = new PostgresCrawlRunRepository(db);
  const gaps = new PostgresGapRepository(db);
  await universities.sync(registry.list());

  const crawl = new CrawlUniversity({ universities, majors, runs, gaps, registry, clock, logger });
  const worker = new CrawlWorker({ runs, crawl, clock, logger, sleepBlocker: createSleepBlocker(logger) });

  return {
    config,
    logger,
    worker,
    queries: new CatalogQueries({ universities, majors, runs, gaps, clock }),
    requestCrawl: new RequestCrawl({ universities, runs, clock }),
    scheduleCrawls: new ScheduleCrawls({ universities, runs, gaps, clock, logger }),
    universities,
    close: () => db.close(),
  };
}

export type Container = Awaited<ReturnType<typeof createContainer>>;
