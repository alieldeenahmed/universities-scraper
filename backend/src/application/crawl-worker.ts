import type { CrawlRunRepository } from "../domain/ports/repositories";
import type { Clock, Logger, SleepBlocker } from "../domain/ports/system";
import type { CrawlUniversity } from "./crawl-university";

interface Deps {
  runs: CrawlRunRepository;
  crawl: CrawlUniversity;
  clock: Clock;
  logger: Logger;
  sleepBlocker: SleepBlocker;
}

export interface CrawlWorkerOptions {
  /** a pending run older than this was never picked up */
  pendingTimeoutMs: number;
  /** a running run older than this is assumed dead */
  runningTimeoutMs: number;
}

const DEFAULTS: CrawlWorkerOptions = {
  pendingTimeoutMs: 6 * 60 * 60 * 1000,
  runningTimeoutMs: 3 * 60 * 60 * 1000,
};

/** Takes pending runs one at a time and crawls them. There is only ever one worker loop per process. */
export class CrawlWorker {
  private readonly options: CrawlWorkerOptions;
  private draining: Promise<number> | null = null;
  private again = false;

  constructor(
    private readonly deps: Deps,
    options: Partial<CrawlWorkerOptions> = {},
  ) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** The previous process died while crawling: those runs will never finish. Call once at startup. */
  async recoverInterrupted(): Promise<number> {
    const count = await this.deps.runs.failInterrupted(this.deps.clock.now());
    if (count > 0) this.deps.logger.warn("closed crawls left running by the previous process", { count });
    return count;
  }

  /** Start working through pending runs in the background. Does nothing if that is already going on. */
  kick(): void {
    void this.drain().catch((err) => this.deps.logger.error("worker failed", { error: String(err) }));
  }

  /**
   * Works until no pending run is left. Concurrent callers share the same pass,
   * and asking while it is busy makes it look once more before it stops (a run
   * requested right at the end of a pass must not wait for the next tick).
   */
  drain(): Promise<number> {
    if (this.draining) {
      this.again = true;
      return this.draining;
    }

    this.draining = (async () => {
      let processed = 0;
      do {
        this.again = false;
        processed += await this.work();
      } while (this.again);
      return processed;
    })().finally(() => {
      this.draining = null;
    });
    return this.draining;
  }

  private async work(): Promise<number> {
    let processed = 0;
    for (;;) {
      await this.deps.runs.expireStale(
        this.deps.clock.now(),
        this.options.pendingTimeoutMs,
        this.options.runningTimeoutMs,
      );

      const run = await this.deps.runs.claimNext(this.deps.clock.now());
      if (!run) return processed;

      const release = this.deps.sleepBlocker.acquire();
      try {
        await this.deps.crawl.execute(run);
      } finally {
        release();
      }
      processed += 1;
    }
  }
}
