/**
 * full        - scrape every major, ignore source versions
 * incremental - skip majors whose source version didn't change
 * repair      - only majors that have an open gap or failed last time
 */
export type CrawlMode = "full" | "incremental" | "repair";

export type CrawlTrigger = "schedule" | "manual" | "repair" | "startup";

export type CrawlStatus =
  | "pending"
  | "running"
  | "completed"
  | "completed_with_issues"
  | "failed"
  | "expired";

export interface CrawlStats {
  discovered: number;
  scraped: number;
  skipped: number;
  failed: number;
  created: number;
  updated: number;
  unchanged: number;
  markedMissing: number;
}

export interface CrawlFailure {
  stage: "start" | "prepare" | "discover" | "persist" | "timeout" | "interrupted" | "unexpected";
  message: string;
}

export interface CrawlRun {
  id: number;
  universityId: number;
  mode: CrawlMode;
  trigger: CrawlTrigger;
  status: CrawlStatus;
  requestedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  progressDone: number;
  progressTotal: number;
  stats: CrawlStats;
  failure: CrawlFailure | null;
}

export const ACTIVE_STATUSES: readonly CrawlStatus[] = ["pending", "running"];

export function emptyStats(): CrawlStats {
  return {
    discovered: 0,
    scraped: 0,
    skipped: 0,
    failed: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    markedMissing: 0,
  };
}

export function isActive(run: Pick<CrawlRun, "status">): boolean {
  return ACTIVE_STATUSES.includes(run.status);
}
