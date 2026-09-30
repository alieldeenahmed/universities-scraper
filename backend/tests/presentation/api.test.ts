import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { CatalogQueries } from "../../src/application/catalog-queries";
import { CrawlUniversity } from "../../src/application/crawl-university";
import { CrawlWorker } from "../../src/application/crawl-worker";
import { RequestCrawl } from "../../src/application/request-crawl";
import { buildServer } from "../../src/presentation/http/server";
import { createHarness, type Harness } from "../support/app-harness";
import { FakeAdapter } from "../support/fake-adapter";
import { scrapedMajor } from "../support/builders";

describe("http api", () => {
  let h: Harness;
  let app: FastifyInstance;
  let worker: CrawlWorker;
  let adapter: FakeAdapter;

  async function build(staticDir?: string, options: { autoRun?: boolean } = {}) {
    const crawl = new CrawlUniversity(h);
    worker = new CrawlWorker({ ...h, crawl, sleepBlocker: { acquire: () => () => {} } });
    // with autoRun off a requested crawl stays pending, which is what the duplicate test needs
    const serverWorker = options.autoRun === false ? ({ kick() {} } as CrawlWorker) : worker;
    return buildServer({
      queries: new CatalogQueries(h),
      requestCrawl: new RequestCrawl(h),
      worker: serverWorker,
      logger: h.logger,
      staticDir,
    });
  }

  beforeEach(async () => {
    adapter = new FakeAdapter({
      majors: [
        scrapedMajor({ externalId: "cs", name: "Computer Science" }),
        scrapedMajor({
          externalId: "film",
          name: "Film",
          degreeType: "Bachelor of Arts",
          faculty: "School of Humanities and Social Sciences",
          department: "Department of the Arts",
        }),
      ],
    });
    h = await createHarness([adapter]);
    app = await build();
  });

  async function crawlAndWait() {
    const res = await app.inject({ method: "POST", url: `/api/universities/${h.university.id}/crawl` });
    await worker.drain();
    return res;
  }

  it("answers the health check", async () => {
    const res = await app.inject({ url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("lists universities before and after the first crawl", async () => {
    let res = await app.inject({ url: "/api/universities" });
    let [uni] = res.json();
    expect(uni).toMatchObject({ slug: "test-uni", activeMajors: 0, due: true, nextDueAt: null });
    expect(uni.health.status).toBe("never_crawled");

    await crawlAndWait();
    res = await app.inject({ url: "/api/universities" });
    [uni] = res.json();
    expect(uni).toMatchObject({ activeMajors: 2, due: false, scheduleEveryHours: 24 });
    expect(uni.health.status).toBe("healthy");
    expect(uni.lastSuccessfulRun.stats.scraped).toBe(2);
  });

  it("starts a crawl on demand and answers 202 with the run", async () => {
    const res = await app.inject({ method: "POST", url: `/api/universities/${h.university.id}/crawl` });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ created: true, run: { mode: "full", trigger: "manual" } });
    await worker.drain();
  });

  it("does not start a second crawl while one is active", async () => {
    app = await build(undefined, { autoRun: false });
    const first = await app.inject({ method: "POST", url: `/api/universities/${h.university.id}/crawl` });
    const second = await app.inject({ method: "POST", url: `/api/universities/${h.university.id}/crawl` });
    expect(second.statusCode).toBe(200);
    expect(second.json().created).toBe(false);
    expect(second.json().run.id).toBe(first.json().run.id);
  });

  it("crawls everything from the crawl all endpoint", async () => {
    const res = await app.inject({ method: "POST", url: "/api/crawls", payload: { mode: "incremental" } });
    expect(res.statusCode).toBe(202);
    expect(res.json().runs).toHaveLength(1);
    expect(res.json().runs[0].run.mode).toBe("incremental");
    await worker.drain();
  });

  it("reports progress and the finished state of a run", async () => {
    const started = (await crawlAndWait()).json();
    const res = await app.inject({ url: `/api/crawls/${started.run.id}` });
    expect(res.json()).toMatchObject({ status: "completed", progress: { done: 2, total: 2 } });

    const list = await app.inject({ url: `/api/crawls?universityId=${h.university.id}` });
    expect(list.json()).toHaveLength(1);
  });

  it("lists majors as light summaries and filters them", async () => {
    await crawlAndWait();
    const all = (await app.inject({ url: "/api/majors" })).json();
    expect(all.map((m: any) => m.name)).toEqual(["Film", "Computer Science"]);
    expect(all[0]).toHaveProperty("descriptionExcerpt");
    expect(all[0]).toHaveProperty("tuitionTotals");
    expect(all[0]).not.toHaveProperty("admissionRequirements");

    const filtered = (await app.inject({ url: "/api/majors?faculty=School%20of%20Humanities%20and%20Social%20Sciences" })).json();
    expect(filtered.map((m: any) => m.name)).toEqual(["Film"]);

    const searched = (await app.inject({ url: "/api/majors?search=comp" })).json();
    expect(searched.map((m: any) => m.name)).toEqual(["Computer Science"]);
  });

  it("returns everything for a single major", async () => {
    await crawlAndWait();
    const [film] = (await app.inject({ url: "/api/majors?search=Film" })).json();
    const res = await app.inject({ url: `/api/majors/${film.id}` });
    const major = res.json();
    expect(major.name).toBe("Film");
    expect(major.admissionRequirements.sections[0].title).toBe("General requirements");
    expect(major.tuition.rates[0].amountPerCreditHour).toBe(700);
    expect(major.firstSeenAt).toMatch(/^2026-09-30T/);
  });

  it("serves facets for the filters", async () => {
    await crawlAndWait();
    const facets = (await app.inject({ url: `/api/facets?universityId=${h.university.id}` })).json();
    expect(facets.faculties.map((f: any) => f.name)).toEqual([
      "School of Humanities and Social Sciences",
      "School of Sciences and Engineering",
    ]);
    expect(facets.degreeTypes).toEqual(["Bachelor of Arts", "Bachelor of Science"]);
  });

  it("lists open gaps", async () => {
    adapter.majors = [scrapedMajor({ externalId: "cs", creditHours: null })];
    await crawlAndWait();
    const gaps = (await app.inject({ url: "/api/gaps" })).json();
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ majorName: "Computer Science", field: "creditHours", kind: "missing_field" });

    const overview = (await app.inject({ url: `/api/universities/${h.university.id}` })).json();
    expect(overview.health.status).toBe("degraded");
    expect(overview.gaps.open).toBe(1);
  });

  it("answers 404 for things that don't exist and 400 for garbage", async () => {
    expect((await app.inject({ url: "/api/majors/99999" })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/universities/99999" })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/api/universities/99999/crawl" })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/majors/abc" })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/crawls", payload: { mode: "everything" } })).statusCode).toBe(400);
    expect((await app.inject({ url: "/api/nope" })).statusCode).toBe(404);
  });

  it("serves the built frontend and falls back to index.html for app routes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "frontend-"));
    writeFileSync(join(dir, "index.html"), "<html><body>app</body></html>");
    app = await build(dir);

    const root = await app.inject({ url: "/" });
    expect(root.statusCode).toBe(200);
    expect(root.body).toContain("app");

    const route = await app.inject({ url: "/universities/1" });
    expect(route.statusCode).toBe(200);
    expect(route.body).toContain("app");

    const api = await app.inject({ url: "/api/nope" });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toEqual({ error: "not found" });
  });
});
