import type { CrawlWorker } from "../application/crawl-worker";
import type { ScheduleCrawls } from "../application/schedule-crawls";
import type { Logger } from "../domain/ports/system";

interface Deps {
  schedule: ScheduleCrawls;
  worker: CrawlWorker;
  logger: Logger;
  tickMs: number;
}

/**
 * Checks for overdue crawls and open gaps, once when the app starts and then on
 * a timer. A laptop that sleeps doesn't restart the app, so the first timer tick
 * after waking up is what catches the crawls that came due meanwhile.
 */
export class SchedulerLoop {
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(private readonly deps: Deps) {}

  /** runs the startup check, then keeps ticking */
  async start(): Promise<void> {
    await this.tick("startup");
    this.timer = setInterval(() => void this.tick("schedule"), this.deps.tickMs);
    // don't keep the process alive just for this
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(trigger: "schedule" | "startup"): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.deps.schedule.execute(trigger);
      // also picks up runs that are pending for other reasons (a crash before the worker started them)
      this.deps.worker.kick();
    } catch (err) {
      this.deps.logger.error("scheduler tick failed", { error: String(err) });
    } finally {
      this.ticking = false;
    }
  }
}
