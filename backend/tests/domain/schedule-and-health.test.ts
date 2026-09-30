import { describe, expect, it } from "vitest";
import { emptyStats, type CrawlRun } from "../../src/domain/crawl";
import { computeHealth } from "../../src/domain/rules/health";
import { isBadlyOverdue, isDue, isRepairDue, repairCooldownMs } from "../../src/domain/rules/schedule";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-09-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * HOUR);
const schedule = { everyHours: 24 };

function run(overrides: Partial<CrawlRun> = {}): CrawlRun {
  return {
    id: 1,
    universityId: 1,
    mode: "full",
    trigger: "schedule",
    status: "completed",
    requestedAt: hoursAgo(1),
    startedAt: hoursAgo(1),
    finishedAt: hoursAgo(1),
    progressDone: 0,
    progressTotal: 0,
    stats: emptyStats(),
    failure: null,
    ...overrides,
  };
}

describe("isDue", () => {
  it("is due when it never ran", () => {
    expect(isDue(null, schedule, now)).toBe(true);
  });

  it("is not due inside the interval", () => {
    expect(isDue(hoursAgo(23), schedule, now)).toBe(false);
  });

  it("is due once the interval has passed", () => {
    expect(isDue(hoursAgo(24), schedule, now)).toBe(true);
    expect(isDue(hoursAgo(80), schedule, now)).toBe(true);
  });
});

describe("isBadlyOverdue", () => {
  it("needs twice the interval", () => {
    expect(isBadlyOverdue(hoursAgo(30), schedule, now)).toBe(false);
    expect(isBadlyOverdue(hoursAgo(49), schedule, now)).toBe(true);
  });

  it("does not count a university that never ran", () => {
    expect(isBadlyOverdue(null, schedule, now)).toBe(false);
  });
});

describe("repair backoff", () => {
  it("doubles with every attempt and stops at a day", () => {
    expect(repairCooldownMs(1)).toBe(1 * HOUR);
    expect(repairCooldownMs(2)).toBe(2 * HOUR);
    expect(repairCooldownMs(3)).toBe(4 * HOUR);
    expect(repairCooldownMs(10)).toBe(24 * HOUR);
  });

  it("repairs right away when nothing was tried before", () => {
    expect(isRepairDue(null, 1, now)).toBe(true);
  });

  it("waits out the cooldown", () => {
    expect(isRepairDue(hoursAgo(1.5), 2, now)).toBe(false);
    expect(isRepairDue(hoursAgo(2.5), 2, now)).toBe(true);
  });
});

describe("computeHealth", () => {
  const clean = { badlyOverdue: false, openGaps: 0, gaveUpGaps: 0 };

  it("is never_crawled without a finished run", () => {
    expect(computeHealth({ ...clean, lastFinished: null }).status).toBe("never_crawled");
  });

  it("is failing when the last run failed", () => {
    const health = computeHealth({
      ...clean,
      lastFinished: run({ status: "failed", failure: { stage: "discover", message: "blocked" } }),
    });
    expect(health.status).toBe("failing");
    expect(health.reasons[0]).toContain("blocked");
  });

  it("is degraded with open gaps even after a clean run", () => {
    const health = computeHealth({ ...clean, lastFinished: run(), openGaps: 2 });
    expect(health.status).toBe("degraded");
    expect(health.reasons).toContain("2 open gaps");
  });

  it("is degraded when the last run had issues", () => {
    expect(computeHealth({ ...clean, lastFinished: run({ status: "completed_with_issues" }) }).status).toBe(
      "degraded",
    );
  });

  it("is healthy when everything is quiet", () => {
    expect(computeHealth({ ...clean, lastFinished: run() })).toEqual({ status: "healthy", reasons: [] });
  });
});
