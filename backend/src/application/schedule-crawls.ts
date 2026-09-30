import type { CrawlRun } from "../domain/crawl";
import type { CrawlRunRepository, GapRepository, UniversityRepository } from "../domain/ports/repositories";
import type { Clock, Logger } from "../domain/ports/system";
import { isDue, isRepairDue, repairCooldownMs } from "../domain/rules/schedule";
import type { University } from "../domain/university";

interface Deps {
  universities: UniversityRepository;
  runs: CrawlRunRepository;
  gaps: GapRepository;
  clock: Clock;
  logger: Logger;
}

export interface ScheduledCrawl {
  university: University;
  run: CrawlRun;
  reason: "overdue" | "repair";
}

const RECENT_RUNS_TO_LOOK_AT = 8;

/**
 * Decides which universities need a crawl right now and queues it. Called on
 * startup (covers a laptop that was off) and on every scheduler tick (covers
 * one that was asleep). Calling it twice in a row queues nothing new.
 */
export class ScheduleCrawls {
  constructor(private readonly deps: Deps) {}

  async execute(trigger: "schedule" | "startup" = "schedule"): Promise<ScheduledCrawl[]> {
    const queued: ScheduledCrawl[] = [];
    const now = this.deps.clock.now();

    for (const university of await this.deps.universities.list()) {
      if (await this.deps.runs.findActive(university.id)) continue;
      if (await this.coolingDown(university, now)) continue;

      const lastSuccess = await this.deps.runs.lastSuccessful(university.id);
      if (isDue(lastSuccess?.finishedAt ?? null, university.schedule, now)) {
        const { run, created } = await this.deps.runs.request(
          { universityId: university.id, mode: "incremental", trigger },
          now,
        );
        if (created) queued.push({ university, run, reason: "overdue" });
        continue;
      }

      const repair = await this.repairIfNeeded(university, now);
      if (repair) queued.push(repair);
    }

    if (queued.length > 0) {
      this.deps.logger.info("queued crawls", {
        trigger,
        universities: queued.map((q) => `${q.university.slug}:${q.reason}`),
      });
    }
    return queued;
  }

  private async repairIfNeeded(university: University, now: Date): Promise<ScheduledCrawl | null> {
    const targets = await this.deps.gaps.repairTargets(university.id);
    if (targets.length === 0) return null;

    const attempts = await this.deps.gaps.maxOpenAttempts(university.id);
    const lastRepair = await this.deps.runs.lastRepair(university.id);
    const lastRepairAt = lastRepair ? (lastRepair.finishedAt ?? lastRepair.requestedAt) : null;
    if (!isRepairDue(lastRepairAt, attempts, now)) return null;

    const { run, created } = await this.deps.runs.request(
      { universityId: university.id, mode: "repair", trigger: "repair" },
      now,
    );
    return created ? { university, run, reason: "repair" } : null;
  }

  /**
   * After failed crawls we wait longer and longer before trying again, so a
   * site that is down or blocking us isn't asked every few minutes. A crawl that
   * was only cut off because the app stopped doesn't count as a failure here.
   */
  private async coolingDown(university: University, now: Date): Promise<boolean> {
    const recent = await this.deps.runs.listRecent({ universityId: university.id, limit: RECENT_RUNS_TO_LOOK_AT });
    const finished = recent.filter((r) => r.finishedAt && r.status !== "expired");

    let failures = 0;
    for (const run of finished) {
      if (run.status === "failed" && run.failure?.stage !== "interrupted") failures += 1;
      else break;
    }
    if (failures === 0) return false;

    const last = finished[0]!;
    return now.getTime() - last.finishedAt!.getTime() < repairCooldownMs(failures);
  }
}
