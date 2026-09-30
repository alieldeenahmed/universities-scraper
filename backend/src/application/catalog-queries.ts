import type { CrawlRun } from "../domain/crawl";
import type { Gap } from "../domain/gap";
import type { Major } from "../domain/major";
import type {
  CrawlRunRepository,
  GapCounts,
  GapRepository,
  MajorFacets,
  MajorFilter,
  MajorRepository,
  UniversityRepository,
} from "../domain/ports/repositories";
import type { Clock } from "../domain/ports/system";
import { computeHealth, type Health } from "../domain/rules/health";
import { isBadlyOverdue, isDue } from "../domain/rules/schedule";
import type { University } from "../domain/university";
import { NotFoundError } from "./errors";

export interface UniversityOverview {
  university: University;
  activeMajors: number;
  missingMajors: number;
  activeRun: CrawlRun | null;
  lastFinishedRun: CrawlRun | null;
  lastSuccessfulRun: CrawlRun | null;
  gaps: GapCounts;
  health: Health;
  /** when the next scheduled crawl is due. Null if it has never crawled, meaning due now. */
  nextDueAt: Date | null;
  due: boolean;
}

interface Deps {
  universities: UniversityRepository;
  majors: MajorRepository;
  runs: CrawlRunRepository;
  gaps: GapRepository;
  clock: Clock;
}

/** Everything the UI reads. No writes in here. */
export class CatalogQueries {
  constructor(private readonly deps: Deps) {}

  async universities(): Promise<UniversityOverview[]> {
    const list = await this.deps.universities.list();
    return Promise.all(list.map((u) => this.overview(u)));
  }

  async university(id: number): Promise<UniversityOverview> {
    const university = await this.deps.universities.findById(id);
    if (!university) throw new NotFoundError(`university ${id}`);
    return this.overview(university);
  }

  majors(filter: MajorFilter): Promise<Major[]> {
    return this.deps.majors.list(filter);
  }

  async major(id: number): Promise<Major> {
    const major = await this.deps.majors.findById(id);
    if (!major) throw new NotFoundError(`major ${id}`);
    return major;
  }

  facets(universityId?: number): Promise<MajorFacets> {
    return this.deps.majors.facets(universityId);
  }

  runs(options: { universityId?: number; limit?: number }): Promise<CrawlRun[]> {
    return this.deps.runs.listRecent({ universityId: options.universityId, limit: options.limit ?? 20 });
  }

  async run(id: number): Promise<CrawlRun> {
    const run = await this.deps.runs.get(id);
    if (!run) throw new NotFoundError(`crawl run ${id}`);
    return run;
  }

  gaps(universityId?: number): Promise<Gap[]> {
    return this.deps.gaps.listUnresolved({ universityId });
  }

  private async overview(university: University): Promise<UniversityOverview> {
    const { majors, runs, gaps, clock } = this.deps;
    const now = clock.now();

    const [activeMajors, missingMajors, activeRun, lastFinishedRun, lastSuccessfulRun, gapCounts] = await Promise.all([
      majors.count(university.id, "active"),
      majors.count(university.id, "missing"),
      runs.findActive(university.id),
      runs.lastFinished(university.id),
      runs.lastSuccessful(university.id),
      gaps.counts(university.id),
    ]);

    const lastSuccessAt = lastSuccessfulRun?.finishedAt ?? null;
    const health = computeHealth({
      lastFinished: lastFinishedRun,
      badlyOverdue: isBadlyOverdue(lastSuccessAt, university.schedule, now),
      openGaps: gapCounts.open,
      gaveUpGaps: gapCounts.gaveUp,
    });

    return {
      university,
      activeMajors,
      missingMajors,
      activeRun,
      lastFinishedRun,
      lastSuccessfulRun,
      gaps: gapCounts,
      health,
      nextDueAt: lastSuccessAt ? new Date(lastSuccessAt.getTime() + university.schedule.everyHours * 3_600_000) : null,
      due: isDue(lastSuccessAt, university.schedule, now),
    };
  }
}
