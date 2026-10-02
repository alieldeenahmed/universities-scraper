import { describe, expect, it } from "vitest";
import type { CrawlRun } from "../domain/crawl";
import type { MajorFacets } from "../domain/major";
import {
  crawlButtonState,
  describeStartResult,
  FAST_POLL_MS,
  pollIntervalMs,
  SLOW_POLL_MS,
  summarizeRun,
} from "./crawl-controls";
import { changeFaculty, clearFilters, departmentOptions, hasActiveFilters } from "./filters";
import type { StartedCrawl } from "./ports";

function run(status: CrawlRun["status"]): CrawlRun {
  return {
    id: 1,
    universityId: 1,
    mode: "full",
    trigger: "manual",
    status,
    requestedAt: new Date(),
    startedAt: null,
    finishedAt: null,
    progress: { done: 0, total: 0 },
    stats: { discovered: 36, scraped: 30, skipped: 6, failed: 0, created: 0, updated: 0, unchanged: 30, markedMissing: 0 },
    failure: null,
  };
}

describe("pollIntervalMs", () => {
  it("polls fast while a crawl is active and slowly otherwise", () => {
    expect(pollIntervalMs([{ activeRun: null }, { activeRun: run("running") }])).toBe(FAST_POLL_MS);
    expect(pollIntervalMs([{ activeRun: run("pending") }])).toBe(FAST_POLL_MS);
    expect(pollIntervalMs([{ activeRun: null }])).toBe(SLOW_POLL_MS);
    expect(pollIntervalMs([])).toBe(SLOW_POLL_MS);
  });
});

describe("crawlButtonState", () => {
  it("is available when nothing is going on", () => {
    expect(crawlButtonState({ activeRun: null }, false)).toEqual({ label: "Crawl now", disabled: false });
  });

  it("is locked while the request is in flight and while a crawl is active", () => {
    expect(crawlButtonState({ activeRun: null }, true).disabled).toBe(true);
    expect(crawlButtonState({ activeRun: run("running") }, false)).toEqual({ label: "Crawling…", disabled: true });
    expect(crawlButtonState({ activeRun: run("pending") }, false)).toEqual({ label: "Queued", disabled: true });
  });
});

describe("describeStartResult", () => {
  const names = new Map([[1, "AUC"]]);
  const started = (created: boolean, universityId = 1): StartedCrawl => ({ universityId, created, run: run("pending") });

  it("talks about the one university by name", () => {
    expect(describeStartResult([started(true)], names)).toBe("Started a crawl for AUC.");
    expect(describeStartResult([started(false)], names)).toBe("AUC is already being crawled.");
  });

  it("summarises several", () => {
    expect(describeStartResult([started(true, 1), started(true, 2), started(false, 3)], names)).toBe(
      "Started 2 crawls, 1 already running.",
    );
    expect(describeStartResult([], names)).toBe("Nothing to crawl.");
  });
});

describe("summarizeRun", () => {
  it("lists what happened", () => {
    expect(summarizeRun(run("completed"))).toBe("36 found, 30 scraped, 6 unchanged, 0 failed");
  });

  it("shows the reason for a failure instead", () => {
    const failed = { ...run("failed"), failure: { stage: "blocked", message: "3 requests in a row were blocked" } };
    expect(summarizeRun(failed)).toBe("3 requests in a row were blocked");
  });
});

describe("filters", () => {
  const facets: MajorFacets = {
    faculties: [
      { name: "Business", departments: ["Accounting", "Economics"] },
      { name: "Sciences", departments: ["Physics", "Economics"] },
    ],
    degreeTypes: ["Bachelor of Arts"],
  };

  it("lists the departments of the chosen faculty, or all of them", () => {
    expect(departmentOptions(facets, "Business")).toEqual(["Accounting", "Economics"]);
    expect(departmentOptions(facets, undefined)).toEqual(["Accounting", "Economics", "Physics"]);
    expect(departmentOptions(facets, "Nope")).toEqual([]);
  });

  it("drops a department that doesn't belong to the newly chosen faculty", () => {
    const next = changeFaculty({ universityId: 1, department: "Accounting" }, "Sciences", facets);
    expect(next).toEqual({ universityId: 1, faculty: "Sciences", department: undefined });
  });

  it("keeps a department that is still valid", () => {
    const next = changeFaculty({ universityId: 1, department: "Economics" }, "Sciences", facets);
    expect(next.department).toBe("Economics");
  });

  it("treats an empty faculty as no faculty", () => {
    expect(changeFaculty({ faculty: "Business" }, "", facets).faculty).toBeUndefined();
  });

  it("knows whether any filter is set and can clear them", () => {
    expect(hasActiveFilters({ universityId: 1 })).toBe(false);
    expect(hasActiveFilters({ universityId: 1, search: "film" })).toBe(true);
    expect(clearFilters({ universityId: 1, search: "film", faculty: "Business" })).toEqual({ universityId: 1 });
  });
});
