import { parseArgs } from "node:util";
import type { CrawlMode } from "../domain/crawl";
import { loadConfig } from "./config";
import { createContainer } from "./container";
import { loadEnvFile } from "./load-env";

const USAGE = `usage: npm run crawl -- [--university <slug>] [--mode full|incremental|repair]

  --university  crawl one university (default: all of them)
  --mode        full (default), incremental or repair`;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      university: { type: "string", short: "u" },
      mode: { type: "string", short: "m", default: "full" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (!["full", "incremental", "repair"].includes(values.mode ?? "")) {
    console.error(`unknown mode "${values.mode}"\n\n${USAGE}`);
    return 2;
  }
  const mode = values.mode as CrawlMode;

  loadEnvFile();
  const app = await createContainer(loadConfig());
  try {
    await app.worker.recoverInterrupted();

    if (values.university) {
      const { universities } = app;
      const university = await universities.findBySlug(values.university);
      if (!university) {
        console.error(`no university called "${values.university}"`);
        return 2;
      }
      await app.requestCrawl.forUniversity(university.id, mode, "manual");
    } else {
      await app.requestCrawl.forAll(mode, "manual");
    }

    await app.worker.drain();

    let exitCode = 0;
    for (const run of await app.queries.runs({ limit: 10 })) {
      if (run.status === "pending") continue;
      const s = run.stats;
      console.log(
        `run ${run.id} (university ${run.universityId}): ${run.status} - ` +
          `${s.discovered} found, ${s.scraped} scraped, ${s.skipped} skipped, ${s.failed} failed`,
      );
      if (run.failure) console.log(`  ${run.failure.stage}: ${run.failure.message}`);
      if (run.status === "failed") exitCode = 1;
    }
    return exitCode;
  } finally {
    await app.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
