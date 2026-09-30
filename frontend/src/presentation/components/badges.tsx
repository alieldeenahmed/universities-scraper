import { statusLabel, type CrawlStatus } from "../../domain/crawl";
import { healthLabel, type HealthStatus } from "../../domain/university";

const HEALTH_TONE: Record<HealthStatus, string> = {
  never_crawled: "",
  healthy: "good",
  degraded: "warn",
  failing: "bad",
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  return <span className={`badge ${HEALTH_TONE[status]}`}>{healthLabel(status)}</span>;
}

const STATUS_TONE: Record<CrawlStatus, string> = {
  pending: "info",
  running: "info",
  completed: "good",
  completed_with_issues: "warn",
  failed: "bad",
  expired: "",
};

export function StatusBadge({ status }: { status: CrawlStatus }) {
  return <span className={`badge ${STATUS_TONE[status]}`}>{statusLabel(status)}</span>;
}
