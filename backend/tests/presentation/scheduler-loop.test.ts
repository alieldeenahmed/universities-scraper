import { describe, expect, it, vi } from "vitest";
import { CrawlUniversity } from "../../src/application/crawl-university";
import { CrawlWorker } from "../../src/application/crawl-worker";
import { ScheduleCrawls } from "../../src/application/schedule-crawls";
import { SchedulerLoop } from "../../src/presentation/scheduler-loop";
import { createHarness } from "../support/app-harness";
import { FakeAdapter, majorsNumbered } from "../support/fake-adapter";

describe("SchedulerLoop", () => {
  it("queues an overdue crawl at startup and hands it to the worker", async () => {
    const h = await createHarness([new FakeAdapter({ majors: majorsNumbered(2) })]);
    const worker = new CrawlWorker({ ...h, crawl: new CrawlUniversity(h), sleepBlocker: { acquire: () => () => {} } });
    const loop = new SchedulerLoop({ schedule: new ScheduleCrawls(h), worker, logger: h.logger, tickMs: 60_000 });

    await loop.start();
    loop.stop();
    await worker.drain();

    const [run] = await h.runs.listRecent({ limit: 5 });
    expect(run).toMatchObject({ trigger: "startup", status: "completed" });
  });

  it("keeps ticking on the timer", async () => {
    vi.useFakeTimers();
    try {
      const schedule = { execute: vi.fn().mockResolvedValue([]) } as unknown as ScheduleCrawls;
      const worker = { kick: vi.fn() } as unknown as CrawlWorker;
      const logger = { debug() {}, info() {}, warn() {}, error: vi.fn() };
      const loop = new SchedulerLoop({ schedule, worker, logger, tickMs: 1000 });

      await loop.start();
      expect(schedule.execute).toHaveBeenLastCalledWith("startup");

      await vi.advanceTimersByTimeAsync(3000);
      expect(schedule.execute).toHaveBeenCalledTimes(4);
      expect(schedule.execute).toHaveBeenLastCalledWith("schedule");

      loop.stop();
      await vi.advanceTimersByTimeAsync(3000);
      expect(schedule.execute).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("survives a failing tick and logs it", async () => {
    const schedule = { execute: vi.fn().mockRejectedValue(new Error("db gone")) } as unknown as ScheduleCrawls;
    const worker = { kick: vi.fn() } as unknown as CrawlWorker;
    const logger = { debug() {}, info() {}, warn() {}, error: vi.fn() };
    const loop = new SchedulerLoop({ schedule, worker, logger, tickMs: 1000 });

    await expect(loop.tick("schedule")).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith("scheduler tick failed", { error: "Error: db gone" });
    // and a later tick still works
    (schedule.execute as any).mockResolvedValue([]);
    await loop.tick("schedule");
    expect(worker.kick).toHaveBeenCalledTimes(1);
  });

  it("does not run two ticks at once", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const schedule = { execute: vi.fn(() => gate.then(() => [])) } as unknown as ScheduleCrawls;
    const worker = { kick: vi.fn() } as unknown as CrawlWorker;
    const logger = { debug() {}, info() {}, warn() {}, error() {} };
    const loop = new SchedulerLoop({ schedule, worker, logger, tickMs: 1000 });

    const first = loop.tick("schedule");
    await loop.tick("schedule"); // returns straight away, the first one is still running
    expect(schedule.execute).toHaveBeenCalledTimes(1);
    release();
    await first;
  });
});
