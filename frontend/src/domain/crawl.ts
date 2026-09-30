export type CrawlMode = "full" | "incremental" | "repair";
export type CrawlTrigger = "schedule" | "manual" | "repair" | "startup";
export type CrawlStatus = "pending" | "running" | "completed" | "completed_with_issues" | "failed" | "expired";

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
  stage: string;
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
  progress: { done: number; total: number };
  stats: CrawlStats;
  failure: CrawlFailure | null;
}

export function isRunActive(run: Pick<CrawlRun, "status"> | null | undefined): boolean {
  return run?.status === "pending" || run?.status === "running";
}

/** 0-100, or null while the crawl hasn't said how many majors it has to do yet */
export function progressPercent(run: Pick<CrawlRun, "progress">): number | null {
  const { done, total } = run.progress;
  if (total <= 0) return null;
  return Math.min(100, Math.round((done / total) * 100));
}

const STATUS_LABELS: Record<CrawlStatus, string> = {
  pending: "Waiting to start",
  running: "Running",
  completed: "Completed",
  completed_with_issues: "Completed with issues",
  failed: "Failed",
  expired: "Expired",
};

export function statusLabel(status: CrawlStatus): string {
  return STATUS_LABELS[status];
}

const TRIGGER_LABELS: Record<CrawlTrigger, string> = {
  schedule: "Scheduled",
  manual: "Manual",
  repair: "Auto repair",
  startup: "On startup",
};

export function triggerLabel(trigger: CrawlTrigger): string {
  return TRIGGER_LABELS[trigger];
}

const MODE_LABELS: Record<CrawlMode, string> = {
  full: "Full",
  incremental: "Incremental",
  repair: "Repair",
};

export function modeLabel(mode: CrawlMode): string {
  return MODE_LABELS[mode];
}
