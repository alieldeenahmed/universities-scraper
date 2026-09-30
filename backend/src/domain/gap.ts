export type GapKind =
  | "missing_field" // a field we expected came back empty
  | "suspect_value" // there is a value but it looks wrong
  | "scrape_failed" // the major couldn't be fetched/parsed at all
  | "count_drop" // a lot fewer majors than last time
  | "discovery_failed"; // couldn't even list the majors

export type GapStatus = "open" | "resolved" | "gave_up";

/** A gap as observed right now, before it has been stored */
export interface GapObservation {
  kind: GapKind;
  field: string | null;
  detail: string;
}

export interface Gap extends GapObservation {
  id: number;
  universityId: number;
  /** null for gaps that concern the whole university */
  majorExternalId: string | null;
  majorName: string | null;
  status: GapStatus;
  /** how many crawls in a row have seen it */
  attempts: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
}

/** After this many sightings we stop retrying it automatically. */
export const MAX_GAP_ATTEMPTS = 5;
