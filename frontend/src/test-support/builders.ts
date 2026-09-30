import type { CrawlRun } from "../domain/crawl";
import type { Gap } from "../domain/gap";
import type { MajorDetail, MajorSummary } from "../domain/major";
import type { University } from "../domain/university";

const now = new Date("2026-09-30T12:00:00Z");

export function makeRun(overrides: Partial<CrawlRun> = {}): CrawlRun {
  return {
    id: 1,
    universityId: 1,
    mode: "full",
    trigger: "manual",
    status: "completed",
    requestedAt: new Date("2026-09-30T10:00:00Z"),
    startedAt: new Date("2026-09-30T10:00:05Z"),
    finishedAt: new Date("2026-09-30T10:02:30Z"),
    progress: { done: 3, total: 3 },
    stats: { discovered: 3, scraped: 3, skipped: 0, failed: 0, created: 3, updated: 0, unchanged: 0, markedMissing: 0 },
    failure: null,
    ...overrides,
  };
}

export function makeUniversity(overrides: Partial<University> = {}): University {
  const finished = makeRun();
  return {
    id: 1,
    slug: "auc",
    name: "The American University in Cairo",
    country: "Egypt",
    website: "https://www.aucegypt.edu",
    scheduleEveryHours: 24,
    activeMajors: 3,
    missingMajors: 0,
    activeRun: null,
    lastFinishedRun: finished,
    lastSuccessfulRun: finished,
    gaps: { open: 0, gaveUp: 0 },
    health: { status: "healthy", reasons: [] },
    nextDueAt: new Date(now.getTime() + 20 * 3_600_000),
    due: false,
    ...overrides,
  };
}

export function makeMajor(overrides: Partial<MajorSummary> = {}): MajorSummary {
  return {
    id: 1,
    universityId: 1,
    name: "Computer Science (B.S.)",
    degreeType: "Bachelor of Science",
    faculty: "School of Sciences and Engineering",
    department: "Department of Computer Science and Engineering",
    creditHours: 130,
    tuitionCurrency: "USD",
    tuitionTotals: [
      { label: "Egyptian students", amount: 91000 },
      { label: "International students", amount: 95550 },
    ],
    descriptionExcerpt: "A modern education in computer science.",
    hasAdmissionRequirements: true,
    sourceUrl: "https://www.aucegypt.edu/academics/undergraduate-programs/computer-science",
    status: "active",
    lastSeenAt: now,
    lastChangedAt: now,
    ...overrides,
  };
}

export function makeDetail(overrides: Partial<MajorDetail> = {}): MajorDetail {
  return {
    ...makeMajor(),
    description: "A modern education in computer science and engineering.",
    admissionRequirements: {
      sections: [
        { title: "Declaration of the Computer Science Major", body: "Students must earn a B in CSCE 1101." },
        { title: "General admission requirements", body: "Submit the online application form." },
      ],
      sourceUrls: ["https://www.aucegypt.edu/admissions/undergraduate-requirements"],
    },
    tuition: {
      currency: "USD",
      rates: [
        { label: "Egyptian students", amountPerCreditHour: 700 },
        { label: "International students", amountPerCreditHour: 735 },
      ],
      estimatedTotals: [
        { label: "Egyptian students", amount: 91000 },
        { label: "International students", amount: 95550 },
      ],
      sourceUrl: "https://www.aucegypt.edu/admissions/tuition-and-financial-assistance",
    },
    firstSeenAt: new Date("2026-09-01T09:00:00Z"),
    ...overrides,
  };
}

export function makeGap(overrides: Partial<Gap> = {}): Gap {
  return {
    id: 1,
    universityId: 1,
    majorExternalId: "film",
    majorName: "Film (B.A.)",
    kind: "missing_field",
    field: "creditHours",
    detail: "credit hours could not be determined",
    status: "open",
    attempts: 2,
    firstSeenAt: new Date("2026-09-29T10:00:00Z"),
    lastSeenAt: new Date("2026-09-30T10:00:00Z"),
    ...overrides,
  };
}
