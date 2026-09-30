import { beforeEach, describe, expect, it } from "vitest";
import { CrawlUniversity } from "../../src/application/crawl-university";
import { RequestCrawl } from "../../src/application/request-crawl";
import { ScheduleCrawls } from "../../src/application/schedule-crawls";
import { createHarness, HOUR, MINUTE, type Harness } from "../support/app-harness";
import { FakeAdapter, majorsNumbered } from "../support/fake-adapter";
import { scrapedMajor } from "../support/builders";

describe("ScheduleCrawls", () => {
  let adapter: FakeAdapter;
  let h: Harness;
  let schedule: ScheduleCrawls;

  async function crawlNow(mode: "full" | "incremental" | "repair" = "full") {
    await h.runs.request({ universityId: h.university.id, mode, trigger: "manual" }, h.clock.now());
    const claimed = await h.runs.claimNext(h.clock.now());
    await new CrawlUniversity(h).execute(claimed!);
  }

  beforeEach(async () => {
    adapter = new FakeAdapter({ majors: majorsNumbered(3) });
    h = await createHarness([adapter]);
    schedule = new ScheduleCrawls(h);
  });

  it("queues a first crawl for a university that never ran", async () => {
    const queued = await schedule.execute("startup");
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ reason: "overdue" });
    expect(queued[0]?.run).toMatchObject({ mode: "incremental", trigger: "startup", status: "pending" });
  });

  it("does not queue a second one while the first is pending", async () => {
    await schedule.execute();
    expect(await schedule.execute()).toEqual([]);
  });

  it("leaves a recently crawled university alone", async () => {
    await crawlNow();
    h.clock.advance(3 * HOUR);
    expect(await schedule.execute()).toEqual([]);
  });

  it("catches up once the interval has passed, e.g. after the laptop was off", async () => {
    await crawlNow();
    h.clock.advance(30 * HOUR);
    const queued = await schedule.execute("startup");
    expect(queued.map((q) => q.reason)).toEqual(["overdue"]);
    expect(queued[0]?.run.trigger).toBe("startup");
  });

  it("only looks at the last successful crawl, a failed one does not reset the schedule", async () => {
    await crawlNow();
    h.clock.advance(25 * HOUR);
    adapter.discoverError = new Error("down");
    await crawlNow();

    h.clock.advance(2 * HOUR); // past the one hour cooldown after a first failure
    expect(await schedule.execute()).toHaveLength(1);
  });

  it("backs off after failures instead of retrying every tick", async () => {
    adapter.discoverError = new Error("down");
    await crawlNow(); // first ever crawl fails

    h.clock.advance(10 * MINUTE);
    expect(await schedule.execute()).toEqual([]);

    h.clock.advance(55 * MINUTE);
    expect(await schedule.execute()).toHaveLength(1);
  });

  it("waits longer after repeated failures", async () => {
    adapter.discoverError = new Error("down");
    for (let i = 0; i < 3; i++) {
      await crawlNow();
      h.clock.advance(5 * HOUR);
    }
    // wind back to 3 hours after the third failure
    h.clock.advance(-2 * HOUR);

    // three failures in a row means a 4 hour cooldown
    expect(await schedule.execute()).toEqual([]);

    h.clock.advance(90 * MINUTE);
    expect(await schedule.execute()).toHaveLength(1);
  });

  it("does not punish a crawl that was only interrupted by the app stopping", async () => {
    await h.runs.request({ universityId: h.university.id, mode: "full", trigger: "manual" }, h.clock.now());
    await h.runs.claimNext(h.clock.now());
    await h.runs.failInterrupted(h.clock.now());

    h.clock.advance(MINUTE);
    expect(await schedule.execute("startup")).toHaveLength(1);
  });

  describe("repair", () => {
    beforeEach(async () => {
      adapter.majors = [scrapedMajor({ externalId: "m1", creditHours: null }), ...majorsNumbered(3).slice(1)];
      await crawlNow();
    });

    it("queues a repair crawl when gaps are open", async () => {
      h.clock.advance(5 * MINUTE);
      const queued = await schedule.execute();
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({ reason: "repair" });
      expect(queued[0]?.run).toMatchObject({ mode: "repair", trigger: "repair" });
    });

    it("waits out the cooldown between repair attempts", async () => {
      h.clock.advance(5 * MINUTE);
      await schedule.execute();
      await h.runs.claimNext(h.clock.now());
      await new CrawlUniversity(h).execute((await h.runs.findActive(h.university.id))!);

      h.clock.advance(30 * MINUTE);
      expect(await schedule.execute()).toEqual([]);

      h.clock.advance(3 * HOUR);
      expect((await schedule.execute()).map((q) => q.reason)).toEqual(["repair"]);
    });

    it("stops repairing once the gap was given up on", async () => {
      await h.db.exec("update crawl_gaps set status = 'gave_up'");
      h.clock.advance(5 * MINUTE);
      expect(await schedule.execute()).toEqual([]);
    });
  });
});

describe("RequestCrawl", () => {
  it("queues a manual full crawl and refuses to double up", async () => {
    const h = await createHarness();
    const request = new RequestCrawl(h);

    const first = await request.forUniversity(h.university.id);
    expect(first.created).toBe(true);
    expect(first.run).toMatchObject({ mode: "full", trigger: "manual", status: "pending" });

    const second = await request.forUniversity(h.university.id);
    expect(second.created).toBe(false);
    expect(second.run.id).toBe(first.run.id);
  });

  it("queues every university for crawl all", async () => {
    const a = new FakeAdapter({ info: { slug: "a", name: "A", country: "x", website: "https://a.test", schedule: { everyHours: 24 } } });
    const b = new FakeAdapter({ info: { slug: "b", name: "B", country: "x", website: "https://b.test", schedule: { everyHours: 24 } } });
    const h = await createHarness([a, b]);

    const all = await new RequestCrawl(h).forAll();
    expect(all.map((r) => r.university.slug).sort()).toEqual(["a", "b"]);
    expect(all.every((r) => r.created)).toBe(true);
  });

  it("rejects an unknown university", async () => {
    const h = await createHarness();
    await expect(new RequestCrawl(h).forUniversity(9999)).rejects.toMatchObject({ name: "NotFoundError" });
  });
});
