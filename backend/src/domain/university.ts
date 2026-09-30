export interface CrawlSchedule {
  /** a crawl counts as overdue once this many hours passed since the last good one */
  everyHours: number;
}

/** What an adapter says about its university. Lives in code, not in the database. */
export interface UniversityInfo {
  slug: string;
  name: string;
  country: string;
  website: string;
  schedule: CrawlSchedule;
}

export interface University extends UniversityInfo {
  id: number;
}
