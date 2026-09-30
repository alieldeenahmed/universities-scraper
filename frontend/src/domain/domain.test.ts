import { describe, expect, it } from "vitest";
import { isRunActive, modeLabel, progressPercent, statusLabel, triggerLabel } from "./crawl";
import { formatCredits, formatDuration, formatMoney, formatRelative } from "./format";
import { describeGap } from "./gap";
import { primaryTuition, sortMajors, type MajorSummary } from "./major";
import { healthLabel } from "./university";

function major(overrides: Partial<MajorSummary>): MajorSummary {
  return {
    id: 1,
    universityId: 1,
    name: "Film",
    degreeType: "Bachelor of Arts",
    faculty: "Humanities",
    department: "Arts",
    creditHours: 120,
    tuitionCurrency: "USD",
    tuitionTotals: [{ label: "Egyptian students", amount: 84000 }],
    descriptionExcerpt: null,
    hasAdmissionRequirements: true,
    sourceUrl: "https://x.test",
    status: "active",
    lastSeenAt: new Date(),
    lastChangedAt: new Date(),
    ...overrides,
  };
}

describe("crawl helpers", () => {
  it("knows which runs are still going", () => {
    expect(isRunActive({ status: "pending" })).toBe(true);
    expect(isRunActive({ status: "running" })).toBe(true);
    expect(isRunActive({ status: "completed" })).toBe(false);
    expect(isRunActive(null)).toBe(false);
  });

  it("turns progress into a percentage, or nothing before the total is known", () => {
    expect(progressPercent({ progress: { done: 9, total: 36 } })).toBe(25);
    expect(progressPercent({ progress: { done: 36, total: 36 } })).toBe(100);
    expect(progressPercent({ progress: { done: 0, total: 0 } })).toBeNull();
  });

  it("has readable labels", () => {
    expect(statusLabel("completed_with_issues")).toBe("Completed with issues");
    expect(triggerLabel("repair")).toBe("Auto repair");
    expect(modeLabel("incremental")).toBe("Incremental");
    expect(healthLabel("degraded")).toBe("Needs a look");
  });
});

describe("describeGap", () => {
  it("names the field in plain words", () => {
    expect(describeGap({ kind: "missing_field", field: "creditHours" })).toBe("Missing field: credit hours");
    expect(describeGap({ kind: "scrape_failed", field: null })).toBe("Could not scrape");
    expect(describeGap({ kind: "suspect_value", field: "somethingNew" })).toBe("Suspect value: somethingNew");
  });
});

describe("formatting", () => {
  it("formats money without decimals", () => {
    expect(formatMoney(91000, "USD")).toBe("$91,000");
  });

  it("does not break on an odd currency code", () => {
    expect(formatMoney(1500, "???")).toBe("1,500 ???");
  });

  it("shows a dash for unknown credits", () => {
    expect(formatCredits(null)).toBe("-");
    expect(formatCredits(130)).toBe("130");
  });

  it("describes times relative to now", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    expect(formatRelative(new Date("2026-09-30T11:59:40Z"), now)).toBe("just now");
    expect(formatRelative(new Date("2026-09-30T11:55:00Z"), now)).toBe("5 minutes ago");
    expect(formatRelative(new Date("2026-09-30T11:00:00Z"), now)).toBe("1 hour ago");
    expect(formatRelative(new Date("2026-10-01T12:00:00Z"), now)).toBe("in 1 day");
  });

  it("formats how long a crawl took", () => {
    const start = new Date("2026-09-30T12:00:00Z");
    expect(formatDuration(start, new Date("2026-09-30T12:00:42Z"))).toBe("42 s");
    expect(formatDuration(start, new Date("2026-09-30T12:02:34Z"))).toBe("2 min 34 s");
    expect(formatDuration(start, null)).toBeNull();
  });
});

describe("sortMajors", () => {
  const list = [
    major({ id: 1, name: "Film", creditHours: 120, tuitionTotals: [{ label: "E", amount: 84000 }] }),
    major({ id: 2, name: "Architecture", creditHours: 150, tuitionTotals: [{ label: "E", amount: 105000 }] }),
    major({ id: 3, name: "Anthropology", creditHours: null, tuitionTotals: [] }),
  ];

  it("sorts text case-insensitively", () => {
    expect(sortMajors(list, "name", "asc").map((m) => m.name)).toEqual(["Anthropology", "Architecture", "Film"]);
    expect(sortMajors(list, "name", "desc").map((m) => m.name)).toEqual(["Film", "Architecture", "Anthropology"]);
  });

  it("sorts numbers and keeps empty values last in both directions", () => {
    expect(sortMajors(list, "creditHours", "asc").map((m) => m.id)).toEqual([1, 2, 3]);
    expect(sortMajors(list, "creditHours", "desc").map((m) => m.id)).toEqual([2, 1, 3]);
  });

  it("sorts by the main tuition total", () => {
    expect(sortMajors(list, "tuition", "desc").map((m) => m.id)).toEqual([2, 1, 3]);
  });

  it("does not change the original array", () => {
    const copy = [...list];
    sortMajors(list, "name", "asc");
    expect(list).toEqual(copy);
  });

  it("finds the primary tuition", () => {
    expect(primaryTuition(list[0]!)?.amount).toBe(84000);
    expect(primaryTuition(list[2]!)).toBeNull();
  });
});
