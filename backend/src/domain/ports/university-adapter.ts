import type { MajorReference, ScrapedMajor } from "../scraped-major";
import type { UniversityInfo } from "../university";

/**
 * One instance per crawl, so it is fine to keep per-run state (shared pages,
 * tuition rates...) on the instance.
 */
export interface UniversityAdapter {
  readonly info: UniversityInfo;

  /** load anything shared between majors. Throwing here fails the whole run. */
  prepare(): Promise<void>;

  /** list the undergraduate majors that exist right now */
  discover(): Promise<MajorReference[]>;

  /** fetch and parse a single major. Throws ScrapeError when it can't. */
  scrape(ref: MajorReference): Promise<ScrapedMajor>;
}

export interface UniversityRegistry {
  list(): UniversityInfo[];
  createAdapter(slug: string): UniversityAdapter;
}
