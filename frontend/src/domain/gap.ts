export type GapKind = "missing_field" | "suspect_value" | "scrape_failed" | "count_drop" | "discovery_failed";
export type GapStatus = "open" | "gave_up";

export interface Gap {
  id: number;
  universityId: number;
  majorExternalId: string | null;
  majorName: string | null;
  kind: GapKind;
  field: string | null;
  detail: string;
  status: GapStatus;
  attempts: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

const KIND_LABELS: Record<GapKind, string> = {
  missing_field: "Missing field",
  suspect_value: "Suspect value",
  scrape_failed: "Could not scrape",
  count_drop: "Fewer majors than before",
  discovery_failed: "Could not list majors",
};

export function gapKindLabel(kind: GapKind): string {
  return KIND_LABELS[kind];
}

const FIELD_LABELS: Record<string, string> = {
  creditHours: "credit hours",
  admissionRequirements: "admission requirements",
  tuition: "tuition",
  description: "description",
  faculty: "faculty",
  department: "department",
};

/** "Missing field: credit hours" / "Could not scrape" */
export function describeGap(gap: Pick<Gap, "kind" | "field">): string {
  const kind = gapKindLabel(gap.kind);
  if (!gap.field) return kind;
  return `${kind}: ${FIELD_LABELS[gap.field] ?? gap.field}`;
}
