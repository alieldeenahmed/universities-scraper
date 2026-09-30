import { beforeEach, describe, expect, it } from "vitest";
import { emptyStats } from "../../src/domain/crawl";
import { PostgresCrawlRunRepository } from "../../src/infrastructure/repositories/crawl-run-repository";
import { PostgresUniversityRepository } from "../../src/infrastructure/repositories/university-repository";
import { universityInfo } from "../support/builders";
import { createTestDb } from "../support/test-db";

const minute = 60 * 1000;
const t0 = new Date("2026-09-30T10:00:00Z");
const at = (mins: number) => new Date(t0.getTime() + mins * minute);

describe("crawl run repository", () => {
  let runs: PostgresCrawlRunRepository;
  let uni: number;
  let otherUni: number;

  beforeEach(async () => {
    const db = await createTestDb();
    runs = new PostgresCrawlRunRepository(db);
    const all = await new PostgresUniversityRepository(db).sync([
      universityInfo({ slug: "a", name: "A" }),
      universityInfo({ slug: "b", name: "B" }),
    ]);
    uni = all.find((u) => u.slug === "a")!.id;
    otherUni = all.find((u) => u.slug === "b")!.id;
  });

  it("creates a pending run", async () => {
    const { run, created } = await runs.request({ universityId: uni, mode: "full", trigger: "manual" }, t0);
    expect(created).toBe(true);
    expect(run).toMatchObject({ status: "pending", mode: "full", trigger: "manual", startedAt: null });
    expect(run.stats).toEqual(emptyStats());
  });

  it("hands back the active run instead of creating a second one", async () => {
    const first = await runs.request({ universityId: uni, mode: "full", trigger: "manual" }, t0);
    const second = await runs.request({ universityId: uni, mode: "incremental", trigger: "schedule" }, at(1));
    expect(second.created).toBe(false);
    expect(second.run.id).toBe(first.run.id);

    // a different university is not affected
    const other = await runs.request({ universityId: otherUni, mode: "full", trigger: "manual" }, at(1));
    expect(other.created).toBe(true);
  });

  it("allows a new run once the previous one finished", async () => {
    const first = await runs.request({ universityId: uni, mode: "full", trigger: "manual" }, t0);
    await runs.claimNext(at(1));
    await runs.finish(first.run.id, { status: "completed", stats: emptyStats(), failure: null }, at(2));

    const next = await runs.request({ universityId: uni, mode: "full", trigger: "manual" }, at(3));
    expect(next.created).toBe(true);
  });

  it("claims the oldest pending run exactly once", async () => {
    const a = await runs.request({ universityId: uni, mode: "full", trigger: "manual" }, t0);
    await runs.request({ universityId: otherUni, mode: "full", trigger: "manual" }, at(1));

    const claimed = await runs.claimNext(at(2));
    expect(claimed?.id).toBe(a.run.id);
    expect(claimed?.status).toBe("running");
    expect(claimed?.startedAt).toEqual(at(2));

    const second = await runs.claimNext(at(2));
    expect(second?.universityId).toBe(otherUni);
    expect(await runs.claimNext(at(2))).toBeNull();
  });

  it("only finishes a run that is still running", async () => {
    const { run } = await runs.request({ universityId: uni, mode: "full", trigger: "manual" }, t0);
    const result = { status: "completed" as const, stats: { ...emptyStats(), scraped: 3 }, failure: null };

    expect(await runs.finish(run.id, result, at(1))).toBe(false); // still pending
    await runs.claimNext(at(1));
    expect(await runs.finish(run.id, result, at(2))).toBe(true);
    expect(await runs.finish(run.id, result, at(3))).toBe(false); // already closed

    const stored = await runs.get(run.id);
    expect(stored?.stats.scraped).toBe(3);
    expect(stored?.finishedAt).toEqual(at(2));
  });

  it("stores progress and failures", async () => {
    const { run } = await runs.request({ universityId: uni, mode: "full", trigger: "manual" }, t0);
    await runs.claimNext(at(1));
    await runs.setProgress(run.id, 4, 36);
    expect(await runs.get(run.id)).toMatchObject({ progressDone: 4, progressTotal: 36 });

    await runs.finish(
      run.id,
      { status: "failed", stats: emptyStats(), failure: { stage: "discover", message: "blocked" } },
      at(2),
    );
    expect((await runs.get(run.id))?.failure).toEqual({ stage: "discover", message: "blocked" });
  });

  it("expires pending runs nobody picked up and running runs that hung", async () => {
    const stalePending = await runs.request({ universityId: uni, mode: "full", trigger: "manual" }, t0);
    const hung = await runs.request({ universityId: otherUni, mode: "full", trigger: "manual" }, t0);
    // claim only the second one
    await runs.claimNext(at(0)); // picks the stale pending one (oldest)
    await runs.finish(stalePending.run.id, { status: "completed", stats: emptyStats(), failure: null }, at(1));
    const again = await runs.request({ universityId: uni, mode: "full", trigger: "manual" }, at(1));
    await runs.claimNext(at(1)); // picks the hung one, the older pending

    const changed = await runs.expireStale(at(60), 15 * minute, 30 * minute);
    expect(changed).toBe(2);
    expect((await runs.get(hung.run.id))?.status).toBe("failed");
    expect((await runs.get(again.run.id))?.status).toBe("expired");
  });

  it("fails interrupted runs on startup", async () => {
    const { run } = await runs.request({ universityId: uni, mode: "full", trigger: "manual" }, t0);
    await runs.claimNext(at(1));
    expect(await runs.failInterrupted(at(5))).toBe(1);
    expect((await runs.get(run.id))?.failure?.stage).toBe("interrupted");
    expect(await runs.findActive(uni)).toBeNull();
  });

  it("finds the latest successful, finished and repair runs", async () => {
    const ok = await runs.request({ universityId: uni, mode: "full", trigger: "schedule" }, t0);
    await runs.claimNext(at(0));
    await runs.finish(ok.run.id, { status: "completed", stats: emptyStats(), failure: null }, at(1));

    const bad = await runs.request({ universityId: uni, mode: "repair", trigger: "repair" }, at(2));
    await runs.claimNext(at(2));
    await runs.finish(
      bad.run.id,
      { status: "failed", stats: emptyStats(), failure: { stage: "prepare", message: "x" } },
      at(3),
    );

    expect((await runs.lastSuccessful(uni))?.id).toBe(ok.run.id);
    expect((await runs.lastFinished(uni))?.id).toBe(bad.run.id);
    expect((await runs.lastRepair(uni))?.id).toBe(bad.run.id);
    expect(await runs.lastSuccessful(otherUni)).toBeNull();
  });

  it("lists recent runs newest first, optionally per university", async () => {
    const a = await runs.request({ universityId: uni, mode: "full", trigger: "manual" }, t0);
    const b = await runs.request({ universityId: otherUni, mode: "full", trigger: "manual" }, at(1));
    const all = await runs.listRecent({ limit: 10 });
    expect(all.map((r) => r.id)).toEqual([b.run.id, a.run.id]);
    expect((await runs.listRecent({ universityId: uni, limit: 10 })).map((r) => r.id)).toEqual([a.run.id]);
  });
});
