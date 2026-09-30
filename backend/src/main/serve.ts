import { networkInterfaces } from "node:os";
import { buildServer } from "../presentation/http/server";
import { SchedulerLoop } from "../presentation/scheduler-loop";
import { loadConfig } from "./config";
import { createContainer } from "./container";
import { loadEnvFile } from "./load-env";

/** addresses other people on the same network can use to open the tool */
function lanUrls(port: number): string[] {
  return Object.values(networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((net) => net.family === "IPv4" && !net.internal)
    .map((net) => `http://${net.address}:${port}`);
}

async function main() {
  loadEnvFile();
  const config = loadConfig();
  const app = await createContainer(config);
  const { logger } = app;

  await app.worker.recoverInterrupted();

  const server = await buildServer({
    queries: app.queries,
    requestCrawl: app.requestCrawl,
    worker: app.worker,
    logger,
    staticDir: config.FRONTEND_DIR,
  });
  await server.listen({ port: config.PORT, host: config.HOST });
  logger.info("listening", { local: `http://localhost:${config.PORT}`, network: lanUrls(config.PORT) });

  const scheduler = new SchedulerLoop({
    schedule: app.scheduleCrawls,
    worker: app.worker,
    logger,
    tickMs: config.SCHEDULER_TICK_SECONDS * 1000,
  });
  if (config.SCHEDULER_ENABLED) {
    await scheduler.start();
    logger.info("scheduler on", { tickSeconds: config.SCHEDULER_TICK_SECONDS });
  } else {
    logger.info("scheduler is off, only manual crawls will run");
  }

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info("shutting down", { signal });
    scheduler.stop();
    await server.close();
    // a crawl that is still going gets marked interrupted on the next start
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
