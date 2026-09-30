import { emptyStats, type CrawlFailure, type CrawlRun, type CrawlStats } from "../domain/crawl";
import { describeError, ScrapeError } from "../domain/errors";
import type { GapObservation } from "../domain/gap";
import type {
  CrawlResult,
  CrawlRunRepository,
  GapRepository,
  MajorRepository,
  UniversityRepository,
} from "../domain/ports/repositories";
import type { Clock, Logger } from "../domain/ports/system";
import type { UniversityAdapter, UniversityRegistry } from "../domain/ports/university-adapter";
import { assessDiscovery } from "../domain/rules/assess-discovery";
import { assessMajor } from "../domain/rules/assess-major";
import type { MajorReference } from "../domain/scraped-major";

export interface CrawlUniversityDeps {
  universities: UniversityRepository;
  majors: MajorRepository;
  runs: CrawlRunRepository;
  gaps: GapRepository;
  registry: UniversityRegistry;
  clock: Clock;
  logger: Logger;
}

export interface CrawlUniversityOptions {
  /** this many blocked responses in a row and we stop asking */
  maxConsecutiveBlocks: number;
}

const DEFAULT_OPTIONS: CrawlUniversityOptions = { maxConsecutiveBlocks: 3 };

const DISCOVERY_GAP_KINDS = ["count_drop", "discovery_failed"] as const;

/** Runs one claimed crawl from start to finish and records how it went. Never throws. */
export class CrawlUniversity {
  private readonly options: CrawlUniversityOptions;

  constructor(
    private readonly deps: CrawlUniversityDeps,
    options: Partial<CrawlUniversityOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async execute(run: CrawlRun): Promise<CrawlResult> {
    const { logger } = this.deps;
    let result: CrawlResult;

    try {
      result = await this.crawl(run);
    } catch (err) {
      logger.error("crawl crashed", { runId: run.id, error: describeError(err) });
      result = { status: "failed", stats: emptyStats(), failure: { stage: "unexpected", message: describeError(err) } };
    }

    const closed = await this.deps.runs.finish(run.id, result, this.deps.clock.now());
    if (!closed) logger.warn("run was already closed, result dropped", { runId: run.id });
    logger.info("crawl finished", { runId: run.id, status: result.status, ...result.stats });
    return result;
  }

  private async crawl(run: CrawlRun): Promise<CrawlResult> {
    const { universities, registry, logger } = this.deps;
    const stats = emptyStats();

    const university = await universities.findById(run.universityId);
    if (!university) return failed(stats, "start", `university ${run.universityId} no longer exists`);

    let adapter: UniversityAdapter;
    try {
      adapter = registry.createAdapter(university.slug);
    } catch (err) {
      return failed(stats, "start", describeError(err));
    }
    logger.info("crawl started", { runId: run.id, university: university.slug, mode: run.mode, trigger: run.trigger });

    let refs: MajorReference[];
    try {
      await adapter.prepare();
      refs = await adapter.discover();
    } catch (err) {
      const stage = err instanceof ScrapeError && err.kind === "blocked" ? "blocked" : "discover";
      const detail = describeError(err);
      await this.deps.gaps.syncForUniversity(
        university.id,
        [...DISCOVERY_GAP_KINDS],
        [{ kind: "discovery_failed", field: null, detail }],
        this.deps.clock.now(),
      );
      return failed(stats, stage, detail);
    }
    stats.discovered = refs.length;

    const previous = await this.deps.runs.lastSuccessful(university.id);
    const discovery = assessDiscovery(previous?.stats.discovered ?? null, refs.length);
    await this.deps.gaps.syncForUniversity(
      university.id,
      [...DISCOVERY_GAP_KINDS],
      discovery.gap ? [discovery.gap] : [],
      this.deps.clock.now(),
    );

    if (discovery.safeToMarkMissing) {
      // majors that are gone can't be repaired, stop chasing their gaps
      await this.deps.gaps.resolveForMajorsNotIn(
        university.id,
        refs.map((r) => r.externalId),
        this.deps.clock.now(),
      );
    }

    const targets = await this.pickTargets(run, university.id, refs);
    stats.skipped = refs.length - targets.length;
    await this.deps.runs.setProgress(run.id, 0, targets.length);

    let blocked = 0;
    let done = 0;
    for (const ref of targets) {
      const outcome = await this.scrapeOne(adapter, university.id, ref, stats);
      blocked = outcome === "blocked" ? blocked + 1 : 0;
      done += 1;
      await this.deps.runs.setProgress(run.id, done, targets.length);

      if (blocked >= this.options.maxConsecutiveBlocks) {
        const message = `${blocked} requests in a row were blocked, stopped after ${done} of ${targets.length} majors`;
        logger.warn("site is blocking us, giving up for now", { runId: run.id });
        return { status: "failed", stats, failure: { stage: "blocked", message } };
      }
    }

    if (run.mode !== "repair") {
      const seen = new Set(refs.map((r) => r.externalId));
      await this.touchSkipped(university.id, refs, targets);
      if (discovery.safeToMarkMissing) {
        stats.markedMissing = await this.deps.majors.markMissingExcept(university.id, [...seen], this.deps.clock.now());
      }
    }

    const hadIssues = stats.failed > 0 || discovery.gap !== null;
    return { status: hadIssues ? "completed_with_issues" : "completed", stats, failure: null };
  }

  /** Which of the discovered majors need a fresh scrape in this run. */
  private async pickTargets(run: CrawlRun, universityId: number, refs: MajorReference[]): Promise<MajorReference[]> {
    if (run.mode === "full") return refs;

    const repairIds = new Set(await this.deps.gaps.repairTargets(universityId));
    if (run.mode === "repair") return refs.filter((r) => repairIds.has(r.externalId));

    const stored = await this.deps.majors.sourceVersions(universityId);
    return refs.filter((r) => {
      if (repairIds.has(r.externalId)) return true;
      if (!stored.has(r.externalId)) return true;
      return r.version == null || stored.get(r.externalId) !== r.version;
    });
  }

  private async touchSkipped(
    universityId: number,
    refs: MajorReference[],
    targets: MajorReference[],
  ): Promise<void> {
    const scraped = new Set(targets.map((t) => t.externalId));
    const now = this.deps.clock.now();
    for (const ref of refs) {
      if (!scraped.has(ref.externalId)) await this.deps.majors.markSeen(universityId, ref.externalId, now);
    }
  }

  private async scrapeOne(
    adapter: UniversityAdapter,
    universityId: number,
    ref: MajorReference,
    stats: CrawlStats,
  ): Promise<"ok" | "failed" | "blocked"> {
    const { majors, gaps, clock, logger } = this.deps;
    try {
      const scraped = await adapter.scrape(ref);
      const observed: GapObservation[] = assessMajor(scraped);
      const outcome = await majors.save(universityId, scraped, clock.now());
      await gaps.syncForMajor(universityId, ref.externalId, scraped.name, observed, clock.now());

      stats.scraped += 1;
      stats[outcome] += 1;
      if (observed.length > 0) logger.debug("major has gaps", { major: ref.name, gaps: observed.length });
      return "ok";
    } catch (err) {
      stats.failed += 1;
      logger.warn("could not scrape major", { major: ref.name, error: describeError(err) });
      await gaps
        .syncForMajor(
          universityId,
          ref.externalId,
          ref.name,
          [{ kind: "scrape_failed", field: null, detail: describeError(err) }],
          clock.now(),
        )
        .catch((dbErr) => logger.error("could not record gap", { error: describeError(dbErr) }));
      return err instanceof ScrapeError && err.kind === "blocked" ? "blocked" : "failed";
    }
  }
}

function failed(stats: CrawlStats, stage: CrawlFailure["stage"], message: string): CrawlResult {
  return { status: "failed", stats, failure: { stage, message } };
}
