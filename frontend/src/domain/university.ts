import type { CrawlRun } from "./crawl";

export type HealthStatus = "never_crawled" | "healthy" | "degraded" | "failing";

export interface Health {
  status: HealthStatus;
  reasons: string[];
}

export interface University {
  id: number;
  slug: string;
  name: string;
  country: string;
  website: string;
  scheduleEveryHours: number;
  activeMajors: number;
  missingMajors: number;
  activeRun: CrawlRun | null;
  lastFinishedRun: CrawlRun | null;
  lastSuccessfulRun: CrawlRun | null;
  gaps: { open: number; gaveUp: number };
  health: Health;
  /** null when it has never crawled, which means it is due right now */
  nextDueAt: Date | null;
  due: boolean;
}

const HEALTH_LABELS: Record<HealthStatus, string> = {
  never_crawled: "Not crawled yet",
  healthy: "Healthy",
  degraded: "Needs a look",
  failing: "Failing",
};

export function healthLabel(status: HealthStatus): string {
  return HEALTH_LABELS[status];
}
