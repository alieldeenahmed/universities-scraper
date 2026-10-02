import type { CrawlStatus } from "../../domain/crawl";
import type { HealthStatus } from "../../domain/university";
import type { MarkerShape } from "../components/marker";

export type Tone = "good" | "warn" | "bad" | "info" | "neutral";

export interface StatusStyle {
  shape: MarkerShape;
  tone: Tone;
}

/** dot = fine, diamond = look at it, square = broken, ring = nothing there yet */
export const HEALTH_STYLE: Record<HealthStatus, StatusStyle> = {
  healthy: { shape: "dot", tone: "good" },
  degraded: { shape: "diamond", tone: "warn" },
  failing: { shape: "square", tone: "bad" },
  never_crawled: { shape: "ring", tone: "neutral" },
};

export const RUN_STYLE: Record<CrawlStatus, StatusStyle> = {
  pending: { shape: "ring", tone: "info" },
  running: { shape: "dot", tone: "info" },
  completed: { shape: "dot", tone: "good" },
  completed_with_issues: { shape: "diamond", tone: "warn" },
  failed: { shape: "square", tone: "bad" },
  expired: { shape: "ring", tone: "neutral" },
};

const TONE_COLOR: Record<Tone, string> = {
  good: "var(--green)",
  warn: "var(--amber)",
  bad: "var(--red)",
  info: "var(--blue)",
  neutral: "var(--gray)",
};

export function toneColor(tone: Tone): string {
  return TONE_COLOR[tone];
}
