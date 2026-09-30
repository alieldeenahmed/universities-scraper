import type { CrawlMode, CrawlRun } from "../domain/crawl";
import type { Gap } from "../domain/gap";
import type { MajorDetail, MajorFacets, MajorFilter, MajorSummary } from "../domain/major";
import type { University } from "../domain/university";

export interface StartedCrawl {
  universityId: number;
  /** false when that university already had a crawl going and nothing new was queued */
  created: boolean;
  run: CrawlRun;
}

/** Everything the ui needs from the backend. Implemented in infrastructure, faked in tests. */
export interface CatalogGateway {
  listUniversities(): Promise<University[]>;
  listMajors(filter: MajorFilter): Promise<MajorSummary[]>;
  getMajor(id: number): Promise<MajorDetail>;
  getFacets(universityId?: number): Promise<MajorFacets>;
  startCrawl(universityId: number, mode: CrawlMode): Promise<StartedCrawl>;
  startCrawlAll(mode: CrawlMode): Promise<StartedCrawl[]>;
  listRuns(options?: { universityId?: number; limit?: number }): Promise<CrawlRun[]>;
  listGaps(universityId?: number): Promise<Gap[]>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
