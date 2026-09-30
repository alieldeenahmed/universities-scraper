import { describe, expect, it } from "vitest";
import { assessMajor } from "../../src/domain/rules/assess-major";
import { assessDiscovery } from "../../src/domain/rules/assess-discovery";
import type { ScrapedMajor } from "../../src/domain/scraped-major";

function major(overrides: Partial<ScrapedMajor> = {}): ScrapedMajor {
  return {
    externalId: "1",
    name: "Computer Science",
    degreeType: "Bachelor of Science",
    faculty: "School of Sciences and Engineering",
    department: "Department of Computer Science and Engineering",
    description: "A long enough description of the program that goes well past the minimum length we expect.",
    creditHours: 130,
    admissionRequirements: { sections: [{ title: "General", body: "Apply online." }], sourceUrls: [] },
    tuition: {
      currency: "USD",
      rates: [{ label: "Egyptian students", amountPerCreditHour: 700 }],
      estimatedTotals: [{ label: "Egyptian students", amount: 91000 }],
      sourceUrl: "https://example.edu/tuition",
    },
    sourceUrl: "https://example.edu/cs",
    sourceVersion: "1",
    warnings: [],
    ...overrides,
  };
}

describe("assessMajor", () => {
  it("finds nothing wrong with a complete major", () => {
    expect(assessMajor(major())).toEqual([]);
  });

  it("flags every empty field", () => {
    const gaps = assessMajor(
      major({
        faculty: null,
        department: null,
        description: null,
        creditHours: null,
        admissionRequirements: null,
        tuition: null,
      }),
    );
    expect(gaps.map((g) => g.field).sort()).toEqual(
      ["admissionRequirements", "creditHours", "department", "description", "faculty", "tuition"].sort(),
    );
    expect(gaps.every((g) => g.kind === "missing_field")).toBe(true);
  });

  it("treats an admission block without sections as missing", () => {
    const gaps = assessMajor(major({ admissionRequirements: { sections: [], sourceUrls: [] } }));
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.field).toBe("admissionRequirements");
  });

  it("flags a suspiciously low credit hour total", () => {
    const gaps = assessMajor(major({ creditHours: 46 }));
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ kind: "suspect_value", field: "creditHours" });
  });

  it("flags a very short description as suspect, not missing", () => {
    const gaps = assessMajor(major({ description: "Short." }));
    expect(gaps[0]).toMatchObject({ kind: "suspect_value", field: "description" });
  });

  it("turns adapter warnings into suspect values", () => {
    const gaps = assessMajor(major({ warnings: [{ field: "creditHours", message: "sections add up to 76" }] }));
    expect(gaps).toEqual([{ kind: "suspect_value", field: "creditHours", detail: "sections add up to 76" }]);
  });
});

describe("assessDiscovery", () => {
  it("is fine on the first run", () => {
    expect(assessDiscovery(null, 36)).toEqual({ gap: null, safeToMarkMissing: true });
  });

  it("ignores small normal changes", () => {
    expect(assessDiscovery(36, 34).gap).toBeNull();
  });

  it("warns on a drop but still marks missing above half", () => {
    const result = assessDiscovery(36, 24);
    expect(result.gap?.kind).toBe("count_drop");
    expect(result.safeToMarkMissing).toBe(true);
  });

  it("refuses to mark majors missing when more than half disappeared", () => {
    const result = assessDiscovery(36, 10);
    expect(result.gap?.kind).toBe("count_drop");
    expect(result.safeToMarkMissing).toBe(false);
  });

  it("treats an empty discovery as broken", () => {
    const result = assessDiscovery(36, 0);
    expect(result.gap?.detail).toMatch(/no majors/);
    expect(result.safeToMarkMissing).toBe(false);
  });

  it("does not compare against a tiny previous run", () => {
    expect(assessDiscovery(3, 1)).toEqual({ gap: null, safeToMarkMissing: true });
  });
});
