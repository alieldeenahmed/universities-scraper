import type { ScrapedMajor } from "../../src/domain/scraped-major";
import type { UniversityInfo } from "../../src/domain/university";

export function universityInfo(overrides: Partial<UniversityInfo> = {}): UniversityInfo {
  return {
    slug: "test-uni",
    name: "Test University",
    country: "Egypt",
    website: "https://test.example.edu",
    schedule: { everyHours: 24 },
    ...overrides,
  };
}

export function scrapedMajor(overrides: Partial<ScrapedMajor> = {}): ScrapedMajor {
  return {
    externalId: "100",
    name: "Computer Science",
    degreeType: "Bachelor of Science",
    faculty: "School of Sciences and Engineering",
    department: "Department of Computer Science and Engineering",
    description: "A long enough description of the program that goes well past the minimum length we expect.",
    creditHours: 130,
    admissionRequirements: {
      sections: [{ title: "General requirements", body: "Apply online before the deadline." }],
      sourceUrls: ["https://test.example.edu/admissions"],
    },
    tuition: {
      currency: "USD",
      rates: [{ label: "Egyptian students", amountPerCreditHour: 700 }],
      estimatedTotals: [{ label: "Egyptian students", amount: 91000 }],
      sourceUrl: "https://test.example.edu/tuition",
    },
    sourceUrl: "https://test.example.edu/cs",
    sourceVersion: "v1",
    warnings: [],
    ...overrides,
  };
}
