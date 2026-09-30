import type { AdmissionRequirements, Tuition } from "./major";

/** Points at one major on the university's site. Produced by discovery. */
export interface MajorReference {
  externalId: string;
  name: string;
  sourceUrl: string;
  /**
   * Something that changes when the source changes (a modified timestamp, an etag).
   * Lets an incremental crawl skip majors that didn't change.
   */
  version: string | null;
}

export interface ScrapeWarning {
  field: string;
  message: string;
}

/** What an adapter hands back for one major. No database ids in here. */
export interface ScrapedMajor {
  externalId: string;
  name: string;
  degreeType: string | null;
  faculty: string | null;
  department: string | null;
  description: string | null;
  creditHours: number | null;
  admissionRequirements: AdmissionRequirements | null;
  tuition: Tuition | null;
  sourceUrl: string;
  sourceVersion: string | null;
  /** odd but non fatal things noticed while parsing */
  warnings: ScrapeWarning[];
}
