import { describe, expect, it } from "vitest";
import {
  parseBusinessAdmission,
  parseGeneralAdmission,
  parseSchoolAdmission,
  splitCatalogDescription,
} from "../../../src/infrastructure/universities/auc/admission-parsers";
import { parseMainSitePrograms } from "../../../src/infrastructure/universities/auc/main-site-programs";
import { buildTuition, parseUndergraduateRates } from "../../../src/infrastructure/universities/auc/tuition-parser";
import { fixtureJson, fixtureText } from "../../support/fixtures";

describe("parseUndergraduateRates", () => {
  it("reads both undergraduate cards", () => {
    const parsed = parseUndergraduateRates(fixtureText("auc/tuition.html"));
    expect(parsed).toEqual({
      currency: "USD",
      rates: [
        { label: "Egyptian students", amountPerCreditHour: 700 },
        { label: "International students", amountPerCreditHour: 735 },
      ],
    });
  });

  it("returns null when the rate block is gone", () => {
    expect(parseUndergraduateRates("<html><body><h2>Tuition</h2><p>Call us.</p></body></html>")).toBeNull();
  });

  it("skips graduate cards", () => {
    const html = `<section><h2>Tuition Rate per Credit Hour</h2>
      <div class="publications__item"><h3 class="publications__item-heading">$900</h3><div class="publications__item-description"><h4>Graduate students</h4></div></div>
      <div class="publications__item"><h3 class="publications__item-heading">$700</h3><div class="publications__item-description"><h4>Undergraduate Egyptian students</h4></div></div></section>`;
    expect(parseUndergraduateRates(html)?.rates).toEqual([{ label: "Egyptian students", amountPerCreditHour: 700 }]);
  });
});

describe("buildTuition", () => {
  const parsed = {
    currency: "USD",
    rates: [
      { label: "Egyptian students", amountPerCreditHour: 700 },
      { label: "International students", amountPerCreditHour: 735 },
    ],
  };

  it("multiplies the rates by the credit hours", () => {
    const tuition = buildTuition(parsed, 130, "https://x.test/tuition");
    expect(tuition.estimatedTotals).toEqual([
      { label: "Egyptian students", amount: 91000 },
      { label: "International students", amount: 95550 },
    ]);
  });

  it("leaves the totals empty without credit hours", () => {
    expect(buildTuition(parsed, null, "https://x.test/tuition").estimatedTotals).toEqual([]);
  });
});

describe("parseGeneralAdmission", () => {
  const sections = parseGeneralAdmission(fixtureText("auc/admissions-general.html"));

  it("lists the application deadlines", () => {
    const deadlines = sections.find((s) => s.title === "Application deadlines");
    expect(deadlines?.body).toBe(
      ["Spring 2027: 1 Nov", "Fall 2027 Early Admission: 1 Feb", "Fall 2027 Regular Admission: 1 Jun"].join("\n"),
    );
  });

  it("keeps the requirement sections that apply to everyone", () => {
    expect(sections.map((s) => s.title)).toEqual([
      "Application deadlines",
      "General admission requirements",
      "English language requirements",
      "Declaring a major at admission",
    ]);
    const general = sections.find((s) => s.title === "General admission requirements");
    expect(general?.body).toContain("Submit the online application form");
    expect(general?.body).toContain("Two recommendation letters are mandatory");
  });
});

describe("parseSchoolAdmission", () => {
  const sections = parseSchoolAdmission(fixtureText("auc/admissions-se.html"));

  it("returns one section per accordion item", () => {
    expect(sections.map((s) => s.title)).toEqual(["Actuarial Science", "Computer Science", "Engineering Programs"]);
  });

  it("keeps the certificate by certificate rules readable", () => {
    const actuarial = sections[0]!;
    expect(actuarial.body).toContain("American High School Diploma");
    expect(actuarial.body).toMatch(/SAT I-MATH score of 690/);
    expect(actuarial.body).toContain("Thanawiya Amma (Egypt)");
  });
});

describe("parseBusinessAdmission", () => {
  it("collects the covered programs and the selection criteria", () => {
    const parsed = parseBusinessAdmission(fixtureText("auc/admissions-business.html"));
    expect(parsed?.programNames).toEqual([
      "Accounting (BAC)",
      "Economics (BA)",
      "Management of Information and Communication Technology (MICT)",
      "Business and Entrepreneurship (BBE)",
      "Business in Finance (BBF)",
      "Business in Marketing (BBM)",
    ]);
    expect(parsed?.section.body).toContain("Selection is competitive");
    expect(parsed?.section.body).toContain("- High school grades");
    expect(parsed?.section.body).toContain("- Interview");
  });

  it("returns null for a page without the list", () => {
    expect(parseBusinessAdmission("<html><body><main><p>moved</p></main></body></html>")).toBeNull();
  });
});

describe("splitCatalogDescription", () => {
  it("splits a science program at the declaration heading", () => {
    const program = fixtureJson("auc/program-4900.json");
    const { overview, declaration } = splitCatalogDescription(program.description);
    expect(overview).toContain("Bachelor of Science in Computer Science");
    expect(overview).toContain("accredited by the Computing Accreditation Commission of ABET");
    expect(overview).not.toContain("Eligibility Criteria");
    // objectives and outcomes are part of the overview, only the declaration part is split off
    expect(overview).toContain("Program Objectives");
    expect(overview).toContain("Program Learning Outcomes");
    expect(declaration?.title).toBe("Declaration of the Computer Science Major");
    expect(declaration?.body).toMatch(/eligib/i);
  });

  it("stops the declaration at the degree requirements heading", () => {
    const program = fixtureJson("auc/program-5008.json");
    const { declaration } = splitCatalogDescription(program.description);
    expect(declaration?.title).toBe("Declaration Policy");
    expect(declaration?.body).not.toContain("A total of 120 credits");
  });

  it("returns no declaration when the description has none", () => {
    const { overview, declaration } = splitCatalogDescription(
      "<h3>Bachelor of Arts</h3><p>A program about things, with a long enough description to keep as the overview of the page.</p>",
    );
    expect(declaration).toBeNull();
    expect(overview).toContain("A program about things");
  });
});

describe("parseMainSitePrograms", () => {
  const programs = parseMainSitePrograms(fixtureText("auc/main-programs.html"));

  it("reads programs with school, degree type and link", () => {
    const cs = programs?.find((p) => p.name.startsWith("Computer Science, with Specializations"));
    expect(cs).toEqual({
      name: "Computer Science, with Specializations in Embedded Systems, Artificial Intelligence and Cybersecurity - BS",
      school: "School of Sciences and Engineering",
      degreeTypes: ["BS"],
      url: "https://www.aucegypt.edu/academics/undergraduate-programs/computer-science",
    });
  });

  it("returns null when the page no longer carries the data", () => {
    expect(parseMainSitePrograms("<html><body><p>nothing</p></body></html>")).toBeNull();
  });
});
