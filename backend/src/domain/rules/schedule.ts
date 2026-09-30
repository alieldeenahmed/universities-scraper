import type { CrawlSchedule } from "../university";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** A university has never been crawled successfully, or the last good crawl is older than its interval. */
export function isDue(lastSuccessAt: Date | null, schedule: CrawlSchedule, now: Date): boolean {
  if (!lastSuccessAt) return true;
  return now.getTime() - lastSuccessAt.getTime() >= schedule.everyHours * HOUR_MS;
}

/** Overdue by a wide margin. Used by the health check, not by the scheduler. */
export function isBadlyOverdue(lastSuccessAt: Date | null, schedule: CrawlSchedule, now: Date): boolean {
  if (!lastSuccessAt) return false;
  return now.getTime() - lastSuccessAt.getTime() >= schedule.everyHours * HOUR_MS * 2;
}

const REPAIR_BASE_MINUTES = 60;
const REPAIR_MAX_MINUTES = 24 * 60;

/**
 * How long to wait before trying to fix the same gaps again. The more times
 * we've already seen them, the longer the pause, so a page that is permanently
 * broken doesn't get hit every hour forever.
 */
export function repairCooldownMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  const minutes = Math.min(REPAIR_BASE_MINUTES * 2 ** exponent, REPAIR_MAX_MINUTES);
  return minutes * MINUTE_MS;
}

export function isRepairDue(lastRepairAt: Date | null, openAttempts: number, now: Date): boolean {
  if (!lastRepairAt) return true;
  return now.getTime() - lastRepairAt.getTime() >= repairCooldownMs(openAttempts);
}
