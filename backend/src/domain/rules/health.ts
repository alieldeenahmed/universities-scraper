import type { CrawlRun } from "../crawl";

export type HealthStatus = "never_crawled" | "healthy" | "degraded" | "failing";

export interface HealthInput {
  lastFinished: CrawlRun | null;
  badlyOverdue: boolean;
  openGaps: number;
  gaveUpGaps: number;
}

export interface Health {
  status: HealthStatus;
  reasons: string[];
}

export function computeHealth(input: HealthInput): Health {
  const { lastFinished, badlyOverdue, openGaps, gaveUpGaps } = input;

  if (!lastFinished) return { status: "never_crawled", reasons: ["no crawl has finished yet"] };

  if (lastFinished.status === "failed") {
    const why = lastFinished.failure?.message ?? "unknown error";
    return { status: "failing", reasons: [`last crawl failed: ${why}`] };
  }

  const reasons: string[] = [];
  if (badlyOverdue) reasons.push("last good crawl is well past its schedule");
  if (lastFinished.status === "completed_with_issues") reasons.push("last crawl finished with issues");
  if (openGaps > 0) reasons.push(`${openGaps} open gap${openGaps === 1 ? "" : "s"}`);
  if (gaveUpGaps > 0) reasons.push(`${gaveUpGaps} gap${gaveUpGaps === 1 ? "" : "s"} need attention`);

  return { status: reasons.length > 0 ? "degraded" : "healthy", reasons };
}
