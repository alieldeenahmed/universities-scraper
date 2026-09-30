export interface TuitionRate {
  label: string;
  amountPerCreditHour: number;
}

export interface TuitionTotal {
  label: string;
  amount: number;
}

export interface Tuition {
  currency: string;
  rates: TuitionRate[];
  estimatedTotals: TuitionTotal[];
  sourceUrl: string;
}

export interface AdmissionSection {
  title: string;
  body: string;
}

export interface AdmissionRequirements {
  sections: AdmissionSection[];
  sourceUrls: string[];
}

/** What the majors table needs. */
export interface MajorSummary {
  id: number;
  universityId: number;
  name: string;
  degreeType: string | null;
  faculty: string | null;
  department: string | null;
  creditHours: number | null;
  tuitionCurrency: string | null;
  tuitionTotals: TuitionTotal[];
  descriptionExcerpt: string | null;
  hasAdmissionRequirements: boolean;
  sourceUrl: string;
  status: "active" | "missing";
  lastSeenAt: Date;
  lastChangedAt: Date;
}

export interface MajorDetail extends MajorSummary {
  description: string | null;
  admissionRequirements: AdmissionRequirements | null;
  tuition: Tuition | null;
  firstSeenAt: Date;
}

export interface MajorFilter {
  universityId?: number;
  faculty?: string;
  department?: string;
  degreeType?: string;
  search?: string;
}

export interface MajorFacets {
  faculties: { name: string; departments: string[] }[];
  degreeTypes: string[];
}

export type MajorSortKey = "name" | "faculty" | "department" | "degreeType" | "creditHours" | "tuition";
export type SortDirection = "asc" | "desc";

/** the first total is the one for the main student group (Egyptian students at AUC) */
export function primaryTuition(major: Pick<MajorSummary, "tuitionTotals">): TuitionTotal | null {
  return major.tuitionTotals[0] ?? null;
}

function compareText(a: string | null, b: string | null): number {
  // empty values go last whichever way we sort, handled by the caller
  return (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" });
}

function sortValue(major: MajorSummary, key: MajorSortKey): string | number | null {
  switch (key) {
    case "name":
      return major.name;
    case "faculty":
      return major.faculty;
    case "department":
      return major.department;
    case "degreeType":
      return major.degreeType;
    case "creditHours":
      return major.creditHours;
    case "tuition":
      return primaryTuition(major)?.amount ?? null;
  }
}

export function sortMajors(majors: MajorSummary[], key: MajorSortKey, direction: SortDirection): MajorSummary[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...majors].sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (left == null && right == null) return compareText(a.name, b.name);
    if (left == null) return 1;
    if (right == null) return -1;
    const result =
      typeof left === "number" && typeof right === "number" ? left - right : compareText(String(left), String(right));
    return result === 0 ? compareText(a.name, b.name) : result * factor;
  });
}
