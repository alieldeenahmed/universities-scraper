import { beforeEach, describe, expect, it } from "vitest";
import { CatalogQueries } from "../../src/application/catalog-queries";
import { CrawlUniversity } from "../../src/application/crawl-university";
import { CrawlWorker } from "../../src/application/crawl-worker";
import { RequestCrawl } from "../../src/application/request-crawl";
import type { SleepBlocker } from "../../src/domain/ports/system";
import { createHarness, HOUR, type Harness } from "../support/app-harness";
import { FakeAdapter, majorsNumbered } from "../support/fake-adapter";
import { universityInfo } from "../support/builders";

class CountingSleepBlocker implements SleepBlocker {
  acquired = 0;
  released = 0;
  acquire() {
    this.acquired += 1;
    return () => {
      this.released += 1;
    };
  }
}

describe("CrawlWorker", () => {
  let a: FakeAdapter;
  let b: FakeAdapter;
  let h: Harness;
  let blocker: CountingSleepBlocker;
  let worker: CrawlWorker;

  beforeEach(async () => {
    a = new FakeAdapter({ info: universityInfo({ slug: "a", name: "A" }), majors: majorsNumbered(2) });
    b = new FakeAdapter({ info: universityInfo({ slug: "b", name: "B" }), majors: majorsNumbered(3) });
    h = await createHarness([a, b]);
    blocker = new CountingSleepBlocker();
    worker = new CrawlWorker({ ...h, crawl: new CrawlUniversity(h), sleepBlocker: blocker });
  });

  it("works through every pending run, one after the other", async () => {
    await new RequestCrawl(h).forAll();
    const processed = await worker.drain();

    expect(processed).toBe(2);
    const runs = await h.runs.listRecent({ limit: 10 });
    expect(runs.map((r) => r.status)).toEqual(["completed", "completed"]);
    expect(blocker.acquired).toBe(2);
    expect(blocker.released).toBe(2);
  });

  it("does nothing when the queue is empty", async () => {
    expect(await worker.drain()).toBe(0);
    expect(blocker.acquired).toBe(0);
  });

  it("releases the sleep blocker even when the crawl blows up", async () => {
    await new RequestCrawl(h).forUniversity(h.university.id);
    const exploding = new CrawlWorker({
      ...h,
      crawl: { execute: async () => { throw new Error("boom"); } } as unknown as CrawlUniversity,
      sleepBlocker: blocker,
    });
    await expect(exploding.drain()).rejects.toThrow("boom");
    expect(blocker.released).toBe(blocker.acquired);
  });

  it("shares one pass between concurrent callers", async () => {
    await new RequestCrawl(h).forAll();
    const [first, second] = await Promise.all([worker.drain(), worker.drain()]);
    expect(first).toBe(second);
    expect(await h.runs.listRecent({ limit: 10 })).toHaveLength(2);
    expect(blocker.acquired).toBe(2);
  });

  it("picks up a run that was requested while it was busy", async () => {
    await new RequestCrawl(h).forUniversity(h.university.id);
    const running = worker.drain();
    // requested while the first pass is still in flight
    const late = await h.runs.request(
      { universityId: (await h.universities.findBySlug("b"))!.id, mode: "full", trigger: "manual" },
      h.clock.now(),
    );
    void worker.drain();
    await running;
    await worker.drain();

    expect((await h.runs.get(late.run.id))?.status).toBe("completed");
  });

  it("closes runs that the previous process left running", async () => {
    await new RequestCrawl(h).forUniversity(h.university.id);
    await h.runs.claimNext(h.clock.now());
    expect(await worker.recoverInterrupted()).toBe(1);
    expect(await h.runs.findActive(h.university.id)).toBeNull();
  });

  it("expires pending runs that nobody picked up for too long", async () => {
    const { run } = await new RequestCrawl(h).forUniversity(h.university.id);
    h.clock.advance(7 * HOUR);

    // the default patience is 6 hours, so this one is too old to be worth running
    expect(await worker.drain()).toBe(0);
    expect((await h.runs.get(run.id))?.status).toBe("expired");
  });
});

describe("CatalogQueries", () => {
  it("summarises a university: counts, last runs, gaps and health", async () => {
    const adapter = new FakeAdapter({ majors: majorsNumbered(3) });
    const h = await createHarness([adapter]);
    const queries = new CatalogQueries(h);

    let [overview] = await queries.universities();
    expect(overview).toMatchObject({ activeMajors: 0, due: true, nextDueAt: null });
    expect(overview?.health.status).toBe("never_crawled");

    await new RequestCrawl(h).forUniversity(h.university.id);
    await new CrawlWorker({ ...h, crawl: new CrawlUniversity(h), sleepBlocker: new CountingSleepBlocker() }).drain();

    [overview] = await queries.universities();
    expect(overview).toMatchObject({ activeMajors: 3, missingMajors: 0, due: false });
    expect(overview?.health.status).toBe("healthy");
    expect(overview?.lastSuccessfulRun?.stats.scraped).toBe(3);
    expect(overview?.nextDueAt?.getTime()).toBe(overview!.lastSuccessfulRun!.finishedAt!.getTime() + 24 * HOUR);

    h.clock.advance(25 * HOUR);
    [overview] = await queries.universities();
    expect(overview?.due).toBe(true);
  });

  it("lists, filters and fetches majors", async () => {
    const h = await createHarness([new FakeAdapter({ majors: majorsNumbered(3) })]);
    await new RequestCrawl(h).forUniversity(h.university.id);
    await new CrawlWorker({ ...h, crawl: new CrawlUniversity(h), sleepBlocker: new CountingSleepBlocker() }).drain();
    const queries = new CatalogQueries(h);

    const all = await queries.majors({ universityId: h.university.id });
    expect(all).toHaveLength(3);
    expect(await queries.majors({ universityId: h.university.id, search: "Major 2" })).toHaveLength(1);
    expect((await queries.major(all[0]!.id)).name).toBe(all[0]!.name);
    await expect(queries.major(99999)).rejects.toMatchObject({ name: "NotFoundError" });
    expect((await queries.facets(h.university.id)).faculties).toHaveLength(1);
  });
});
