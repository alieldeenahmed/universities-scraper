import { beforeEach, describe, expect, it } from "vitest";
import { CrawlUniversity } from "../../src/application/crawl-university";
import type { CrawlMode, CrawlTrigger } from "../../src/domain/crawl";
import { ScrapeError } from "../../src/domain/errors";
import { createHarness, HOUR, type Harness } from "../support/app-harness";
import { FakeAdapter, majorsNumbered } from "../support/fake-adapter";
import { scrapedMajor } from "../support/builders";

async function crawl(h: Harness, mode: CrawlMode = "full", trigger: CrawlTrigger = "manual") {
  const { run } = await h.runs.request({ universityId: h.university.id, mode, trigger }, h.clock.now());
  const claimed = await h.runs.claimNext(h.clock.now());
  expect(claimed?.id).toBe(run.id);
  const useCase = new CrawlUniversity(h);
  const result = await useCase.execute(claimed!);
  return { result, run: (await h.runs.get(run.id))! };
}

describe("CrawlUniversity", () => {
  let adapter: FakeAdapter;
  let h: Harness;

  beforeEach(async () => {
    adapter = new FakeAdapter({ majors: majorsNumbered(4) });
    h = await createHarness([adapter]);
  });

  it("stores every discovered major and closes the run", async () => {
    const { result, run } = await crawl(h);

    expect(result.status).toBe("completed");
    expect(result.stats).toMatchObject({ discovered: 4, scraped: 4, created: 4, failed: 0, skipped: 0 });
    expect(await h.majors.count(h.university.id, "active")).toBe(4);
    expect(run.status).toBe("completed");
    expect(run.progressDone).toBe(4);
    expect(run.progressTotal).toBe(4);
    expect(run.finishedAt).not.toBeNull();
  });

  it("skips unchanged majors on an incremental run and scrapes only what moved", async () => {
    await crawl(h, "full");
    adapter.scraped.length = 0;

    h.clock.advance(HOUR);
    adapter.majors = adapter.majors.map((m) =>
      m.externalId === "m2" ? scrapedMajor({ ...m, creditHours: 132, sourceVersion: "v2" }) : m,
    );
    const { result } = await crawl(h, "incremental");

    expect(adapter.scraped).toEqual(["m2"]);
    expect(result.stats).toMatchObject({ scraped: 1, updated: 1, skipped: 3 });
    const majors = await h.majors.list({ universityId: h.university.id });
    expect(majors.find((m) => m.externalId === "m2")?.creditHours).toBe(132);
    // the skipped ones were still seen
    expect(majors.find((m) => m.externalId === "m1")?.lastSeenAt).toEqual(h.clock.now());
  });

  it("scrapes everything on a full run even if nothing changed", async () => {
    await crawl(h, "full");
    adapter.scraped.length = 0;
    const { result } = await crawl(h, "full");
    expect(adapter.scraped).toHaveLength(4);
    expect(result.stats).toMatchObject({ scraped: 4, unchanged: 4 });
  });

  it("keeps going when one major fails and remembers why", async () => {
    adapter.scrapeErrors = { m2: new ScrapeError("parse", "markup changed", "https://x.test/m2") };
    const { result } = await crawl(h);

    expect(result.status).toBe("completed_with_issues");
    expect(result.stats).toMatchObject({ scraped: 3, failed: 1 });
    expect(await h.majors.count(h.university.id, "active")).toBe(3);

    const gaps = await h.gaps.listUnresolved({ universityId: h.university.id });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ majorExternalId: "m2", kind: "scrape_failed" });
    expect(gaps[0]?.detail).toContain("markup changed");
  });

  it("records gaps for incomplete majors and resolves them once they are complete", async () => {
    adapter.majors = [scrapedMajor({ externalId: "m1", creditHours: null, tuition: null })];
    await crawl(h);
    let gaps = await h.gaps.listUnresolved({ universityId: h.university.id });
    expect(gaps.map((g) => g.field).sort()).toEqual(["creditHours", "tuition"]);

    adapter.majors = [scrapedMajor({ externalId: "m1", sourceVersion: "v2" })];
    await crawl(h);
    gaps = await h.gaps.listUnresolved({ universityId: h.university.id });
    expect(gaps).toEqual([]);
  });

  it("repair runs only touch majors with open gaps, even if their version is unchanged", async () => {
    adapter.majors = [
      scrapedMajor({ externalId: "m1", creditHours: null }),
      scrapedMajor({ externalId: "m2", name: "Fine" }),
    ];
    await crawl(h, "full");
    adapter.scraped.length = 0;

    // the source fixed itself without bumping the version
    adapter.majors = [scrapedMajor({ externalId: "m1" }), scrapedMajor({ externalId: "m2", name: "Fine" })];
    const { result } = await crawl(h, "repair", "repair");

    expect(adapter.scraped).toEqual(["m1"]);
    expect(result.stats).toMatchObject({ scraped: 1, updated: 1 });
    expect(await h.gaps.listUnresolved({ universityId: h.university.id })).toEqual([]);
  });

  it("includes majors with open gaps in an incremental run", async () => {
    adapter.majors = [scrapedMajor({ externalId: "m1", creditHours: null })];
    await crawl(h, "full");
    adapter.scraped.length = 0;

    await crawl(h, "incremental");
    expect(adapter.scraped).toEqual(["m1"]);
  });

  it("does not mark anything missing during a repair run", async () => {
    await crawl(h, "full");
    adapter.majors = [];
    const { result } = await crawl(h, "repair", "repair");
    expect(result.stats.markedMissing).toBe(0);
    expect(await h.majors.count(h.university.id, "active")).toBe(4);
  });

  it("marks majors that disappeared as missing", async () => {
    await crawl(h);
    adapter.majors = adapter.majors.slice(0, 3);
    const { result } = await crawl(h);
    expect(result.stats.markedMissing).toBe(1);
    expect(await h.majors.count(h.university.id, "missing")).toBe(1);
  });

  it("flags a big drop in discovered majors and does not mark half the catalog missing", async () => {
    adapter.majors = majorsNumbered(10);
    await crawl(h);

    adapter.majors = majorsNumbered(3);
    const { result } = await crawl(h);

    expect(result.status).toBe("completed_with_issues");
    expect(result.stats.markedMissing).toBe(0);
    expect(await h.majors.count(h.university.id, "active")).toBe(10);
    const gaps = await h.gaps.listUnresolved({ universityId: h.university.id });
    expect(gaps.map((g) => g.kind)).toEqual(["count_drop"]);

    // and the gap goes away once discovery looks normal again
    adapter.majors = majorsNumbered(10);
    await crawl(h);
    expect(await h.gaps.listUnresolved({ universityId: h.university.id })).toEqual([]);
  });

  it("fails the run, and leaves existing data alone, when discovery breaks", async () => {
    await crawl(h);
    adapter.discoverError = new ScrapeError("transient", "HTTP 503");
    const { result, run } = await crawl(h);

    expect(result.status).toBe("failed");
    expect(run.failure?.stage).toBe("discover");
    expect(await h.majors.count(h.university.id, "active")).toBe(4);
    const gaps = await h.gaps.listUnresolved({ universityId: h.university.id });
    expect(gaps.map((g) => g.kind)).toEqual(["discovery_failed"]);
  });

  it("fails the run when preparing fails", async () => {
    adapter.prepareError = new ScrapeError("not_found", "HTTP 404", "https://x.test/catalogs");
    const { run } = await crawl(h);
    expect(run.status).toBe("failed");
    expect(run.failure?.message).toContain("404");
  });

  it("stops when the site keeps blocking and does not wipe anything", async () => {
    await crawl(h);
    adapter.majors = majorsNumbered(10, "v2");
    adapter.scrapeErrors = Object.fromEntries(
      adapter.majors.map((m) => [m.externalId, new ScrapeError("blocked", "challenge")]),
    );
    adapter.scraped.length = 0;

    const { result, run } = await crawl(h, "full");

    expect(adapter.scraped).toHaveLength(3); // stopped after three blocked requests in a row
    expect(result.status).toBe("failed");
    expect(run.failure?.stage).toBe("blocked");
    expect(await h.majors.count(h.university.id, "active")).toBe(4);
    expect(await h.majors.count(h.university.id, "missing")).toBe(0);
  });

  it("does not stop for blocked responses that aren't in a row", async () => {
    adapter.majors = majorsNumbered(6);
    adapter.scrapeErrors = {
      m1: new ScrapeError("blocked", "x"),
      m3: new ScrapeError("blocked", "x"),
      m5: new ScrapeError("blocked", "x"),
    };
    const { result } = await crawl(h);
    expect(result.stats).toMatchObject({ scraped: 3, failed: 3 });
    expect(result.status).toBe("completed_with_issues");
  });
});
