export interface AdmissionSection {
  title: string;
  body: string;
}

export interface AdmissionRequirements {
  sections: AdmissionSection[];
  sourceUrls: string[];
}

export interface TuitionRate {
  /** e.g. "Egyptian students" */
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
  /** credit hours x rate, only present when the credit hours are known */
  estimatedTotals: TuitionTotal[];
  sourceUrl: string;
}

export interface Faculty {
  id: number;
  universityId: number;
  name: string;
}

export interface Department {
  id: number;
  facultyId: number | null;
  universityId: number;
  name: string;
}

export type MajorStatus = "active" | "missing";

export interface Major {
  id: number;
  universityId: number;
  /** id inside the university's own system, stable across crawls */
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
  status: MajorStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastChangedAt: Date;
}
