import type {
  CrawlFailure,
  CrawlMode,
  CrawlRun,
  CrawlStats,
  CrawlStatus,
  CrawlTrigger,
} from "../crawl";
import type { Gap, GapKind, GapObservation } from "../gap";
import type { Major, MajorStatus } from "../major";
import type { ScrapedMajor } from "../scraped-major";
import type { University, UniversityInfo } from "../university";

export interface UniversityRepository {
  /** inserts new universities and refreshes name/schedule of existing ones (matched by slug) */
  sync(infos: UniversityInfo[]): Promise<University[]>;
  list(): Promise<University[]>;
  findById(id: number): Promise<University | null>;
  findBySlug(slug: string): Promise<University | null>;
}

export type UpsertOutcome = "created" | "updated" | "unchanged";

export interface MajorFilter {
  universityId?: number;
  faculty?: string;
  department?: string;
  degreeType?: string;
  search?: string;
  status?: MajorStatus;
}

export interface MajorFacets {
  faculties: { name: string; departments: string[] }[];
  degreeTypes: string[];
}

export interface MajorRepository {
  save(universityId: number, scraped: ScrapedMajor, now: Date): Promise<UpsertOutcome>;
  /** the major was seen but not re-scraped (source version unchanged) */
  markSeen(universityId: number, externalId: string, now: Date): Promise<void>;
  /** external id -> source version, for the majors we currently hold */
  sourceVersions(universityId: number): Promise<Map<string, string | null>>;
  /** flags everything not in `seen` as missing. Returns how many changed. */
  markMissingExcept(universityId: number, seen: string[], now: Date): Promise<number>;
  list(filter: MajorFilter): Promise<Major[]>;
  findById(id: number): Promise<Major | null>;
  facets(universityId?: number): Promise<MajorFacets>;
  count(universityId: number, status: MajorStatus): Promise<number>;
}

export interface CrawlRequest {
  universityId: number;
  mode: CrawlMode;
  trigger: CrawlTrigger;
}

export interface CrawlResult {
  status: Extract<CrawlStatus, "completed" | "completed_with_issues" | "failed">;
  stats: CrawlStats;
  failure: CrawlFailure | null;
}

export interface CrawlRunRepository {
  /**
   * Creates a pending run, unless the university already has a pending/running
   * one. In that case the active one is returned and `created` is false.
   */
  request(req: CrawlRequest, now: Date): Promise<{ run: CrawlRun; created: boolean }>;
  /** pending -> running for the oldest pending run, or null when there is none */
  claimNext(now: Date): Promise<CrawlRun | null>;
  setProgress(id: number, done: number, total: number): Promise<void>;
  /** only applies while the run is still running. Returns false if it was already closed. */
  finish(id: number, result: CrawlResult, now: Date): Promise<boolean>;
  /** pending runs nobody picked up and running runs that never finished */
  expireStale(now: Date, pendingOlderThanMs: number, runningOlderThanMs: number): Promise<number>;
  /** marks every running run as failed. For startup, when the previous process died. */
  failInterrupted(now: Date): Promise<number>;
  get(id: number): Promise<CrawlRun | null>;
  listRecent(options: { universityId?: number; limit: number }): Promise<CrawlRun[]>;
  findActive(universityId: number): Promise<CrawlRun | null>;
  /** latest run that ended as completed / completed_with_issues */
  lastSuccessful(universityId: number): Promise<CrawlRun | null>;
  /** latest run that ended at all (any status except expired) */
  lastFinished(universityId: number): Promise<CrawlRun | null>;
  /** latest run that was started by a repair trigger, finished or not */
  lastRepair(universityId: number): Promise<CrawlRun | null>;
}

export interface GapCounts {
  open: number;
  gaveUp: number;
}

export interface GapRepository {
  /**
   * Record what was seen when one major was (re)scraped: new observations open
   * or bump a gap, anything previously open for this major that wasn't observed
   * is resolved.
   */
  syncForMajor(
    universityId: number,
    externalId: string,
    majorName: string,
    observed: GapObservation[],
    now: Date,
  ): Promise<void>;
  /** same idea for university wide gaps, limited to the given kinds */
  syncForUniversity(
    universityId: number,
    kinds: GapKind[],
    observed: GapObservation[],
    now: Date,
  ): Promise<void>;
  /**
   * Resolves the gaps of majors that are no longer listed. Nothing is going to
   * fill them in, and leaving them open would keep the repair loop busy forever.
   */
  resolveForMajorsNotIn(universityId: number, present: string[], now: Date): Promise<number>;
  /** open and gave_up gaps */
  listUnresolved(options?: { universityId?: number }): Promise<Gap[]>;
  /** external ids of majors that have an open (not given up) gap */
  repairTargets(universityId: number): Promise<string[]>;
  /** highest attempt counter among gaps we would still retry */
  maxOpenAttempts(universityId: number): Promise<number>;
  counts(universityId: number): Promise<GapCounts>;
}
