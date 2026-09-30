import { describe, expect, it } from "vitest";
import {
  extractCreditHours,
  findStatedTotal,
  sumSections,
} from "../../../src/infrastructure/universities/auc/credit-hours";

describe("findStatedTotal", () => {
  it("reads the usual phrasing", () => {
    expect(findStatedTotal("A total of 120 credits is required for the bachelor's degree in Film.")).toBe(120);
    expect(findStatedTotal("Students must complete a minimum of 120 credit hours for the Bachelor of Arts in Economics degree.")).toBe(120);
    expect(findStatedTotal("Students will be required to take a total of 132 credits for the Bachelor of Science Degree in Biology.")).toBe(132);
  });

  it("ignores requirements that aren't the whole degree", () => {
    const text = "Eligible students must complete a minimum of 27 credit hours including ECON 2011 and earn an average grade of B.";
    expect(findStatedTotal(text)).toBeNull();
  });

  it("ignores numbers outside what a bachelor's degree could be", () => {
    expect(findStatedTotal("The bachelor's degree requires a total of 12 credits of electives.")).toBeNull();
  });

  it("prefers the sentence that says total", () => {
    const text = "The degree requires at least 100 credit hours in the major. A total of 130 credits is required for the degree.";
    expect(findStatedTotal(text)).toBe(130);
  });
});

describe("sumSections", () => {
  it("adds up exact counts", () => {
    expect(sumSections(["Core Curriculum (33 credits)", "Major (65 credits)", "Electives (6 credits)"])).toEqual({
      exactSum: 104,
      complete: true,
    });
  });

  it("is incomplete when a section has no count", () => {
    expect(sumSections(["Core Curriculum (40 credits)", "Electives"]).complete).toBe(false);
  });

  it("is incomplete when a section has a range", () => {
    expect(sumSections(["Core (37 credits)", "Concentration (48 - 51 credits)"])).toEqual({
      exactSum: 37,
      complete: false,
    });
  });

  it("copes with no sections", () => {
    expect(sumSections([])).toEqual({ exactSum: 0, complete: false });
  });
});

describe("extractCreditHours", () => {
  it("uses the stated total and stays quiet when the sections agree", () => {
    const result = extractCreditHours("A total of 130 credits is required for the bachelor's degree.", [
      "Core (33 credits)",
      "Major (65 credits)",
      "Collateral (26 credits)",
      "Electives (6 credits)",
    ]);
    expect(result).toEqual({ value: 130, source: "stated", warnings: [] });
  });

  it("does not trust an incomplete section sum over the stated total", () => {
    // arabic studies: sections only add up to 76 because the electives have no count
    const result = extractCreditHours("A total of 120 credits is required for a bachelor's degree.", [
      "Core Curriculum (40 credits)",
      "Concentration Requirements (36 credits)",
      "Electives",
    ]);
    expect(result.value).toBe(120);
    expect(result.warnings).toEqual([]);
  });

  it("warns when a fully counted breakdown contradicts the stated total", () => {
    const result = extractCreditHours("A total of 120 credits is required for the bachelor's degree.", [
      "Core (33 credits)",
      "Major (40 credits)",
    ]);
    expect(result.value).toBe(120);
    expect(result.warnings[0]?.message).toMatch(/120 credits but the sections add up to 73/);
  });

  it("falls back to the section sum with a warning", () => {
    const result = extractCreditHours("No total mentioned anywhere.", [
      "Core (33 credits)",
      "Major (65 credits)",
      "Collateral (26 credits)",
      "Electives (6 credits)",
    ]);
    expect(result.value).toBe(130);
    expect(result.source).toBe("sections");
    expect(result.warnings).toHaveLength(1);
  });

  it("gives up rather than guess a tiny sum", () => {
    const result = extractCreditHours("Nothing here.", ["Core (37 credits)", "Concentration (48 - 51 credits)"]);
    expect(result).toEqual({ value: null, source: null, warnings: [] });
  });
});
