import { isRunActive, type CrawlRun } from "../domain/crawl";
import type { University } from "../domain/university";
import type { StartedCrawl } from "./ports";

export const FAST_POLL_MS = 2_000;
export const SLOW_POLL_MS = 30_000;

/** Poll quickly while something is crawling so the progress bar moves, slowly otherwise to notice scheduled crawls. */
export function pollIntervalMs(universities: Pick<University, "activeRun">[]): number {
  return universities.some((u) => isRunActive(u.activeRun)) ? FAST_POLL_MS : SLOW_POLL_MS;
}

export interface CrawlButtonState {
  label: string;
  disabled: boolean;
}

export function crawlButtonState(university: Pick<University, "activeRun">, pendingRequest: boolean): CrawlButtonState {
  if (pendingRequest) return { label: "Starting…", disabled: true };
  const run = university.activeRun;
  if (run?.status === "running") return { label: "Crawling…", disabled: true };
  if (run?.status === "pending") return { label: "Queued", disabled: true };
  return { label: "Crawl now", disabled: false };
}

/** One line for the toast after someone pressed a crawl button. */
export function describeStartResult(results: StartedCrawl[], names: Map<number, string>): string {
  const started = results.filter((r) => r.created);
  const alreadyRunning = results.filter((r) => !r.created);

  if (results.length === 1) {
    const only = results[0]!;
    const name = names.get(only.universityId) ?? "the university";
    return only.created ? `Started a crawl for ${name}.` : `${name} is already being crawled.`;
  }

  const parts: string[] = [];
  if (started.length > 0) parts.push(`Started ${started.length} crawl${started.length === 1 ? "" : "s"}`);
  if (alreadyRunning.length > 0) parts.push(`${alreadyRunning.length} already running`);
  return parts.length > 0 ? `${parts.join(", ")}.` : "Nothing to crawl.";
}

/** "36 found, 36 scraped, 0 failed" */
export function summarizeRun(run: Pick<CrawlRun, "stats" | "status" | "failure">): string {
  if (run.status === "failed" && run.failure) return run.failure.message;
  const { discovered, scraped, skipped, failed } = run.stats;
  const parts = [`${discovered} found`, `${scraped} scraped`];
  if (skipped > 0) parts.push(`${skipped} unchanged`);
  parts.push(`${failed} failed`);
  return parts.join(", ");
}
