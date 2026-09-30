import { describe, expect, it } from "vitest";
import { htmlToText } from "../../../src/infrastructure/universities/auc/html-text";
import {
  baseName,
  bestMatch,
  headingAppliesTo,
  normalizeName,
  slugify,
} from "../../../src/infrastructure/universities/auc/name-match";

describe("htmlToText", () => {
  it("separates paragraphs and turns lists into dashes", () => {
    const text = htmlToText("<p>First&nbsp;part</p><p>Second</p><ul><li>one</li><li>two</li></ul>");
    expect(text).toBe("First part\n\nSecond\n\n- one\n- two");
  });

  it("keeps <br> line breaks and collapses stray whitespace", () => {
    expect(htmlToText("<p><strong>Canadian Certificate</strong><br>Applicants   must\n complete math.</p>")).toBe(
      "Canadian Certificate\nApplicants must complete math.",
    );
  });

  it("keeps paragraphs inside a list item on the bullet line and skips empty items", () => {
    expect(htmlToText("<ul><li><p>Interview</p><p>&nbsp;</p></li><li>&nbsp;</li></ul>")).toBe("- Interview");
  });

  it("drops scripts and styles", () => {
    expect(htmlToText("<div>hi<script>alert(1)</script><style>p{}</style></div>")).toBe("hi");
  });
});

describe("name helpers", () => {
  it("normalizes degree tags so two sites agree", () => {
    const catalog = "Computer Science with specializations in Embedded Systems, Artificial Intelligence and Cybersecurity (B.S.)";
    const site = "Computer Science, with Specializations in Embedded Systems, Artificial Intelligence and Cybersecurity - BS";
    expect(normalizeName(catalog)).toBe(normalizeName(site));
  });

  it("builds a base name and slug without the degree", () => {
    expect(baseName("Actuarial Science (B.S.)")).toBe("actuarial science");
    expect(slugify("Business & Entrepreneurship (B.B.E.)")).toBe("business-and-entrepreneurship");
  });

  it("matches short admission headings to long program names", () => {
    expect(headingAppliesTo("Computer Science", "Computer Science with specializations in Embedded Systems (B.S.)")).toBe(true);
    expect(headingAppliesTo("Biology", "Biology, with Specializations in Genomics (B.Sc.)")).toBe(true);
    expect(headingAppliesTo("Data Science", "Data Science (B.Sc.)")).toBe(true);
  });

  it("does not match a different program that only shares a word", () => {
    expect(headingAppliesTo("Computer Science", "Computer Engineering with specializations (B.S)")).toBe(false);
    expect(headingAppliesTo("Mathematics", "Applied Mathematics (B.S.)")).toBe(false);
  });

  it("maps the engineering programs heading onto engineering majors only", () => {
    expect(headingAppliesTo("Engineering Programs", "Mechanical Engineering, with concentrations (B.S.)")).toBe(true);
    expect(headingAppliesTo("Engineering Programs", "Computer Science (B.S.)")).toBe(false);
  });

  it("finds the same program across sites, and refuses weak matches", () => {
    const candidates = ["Accounting - BAC", "Economics - BA", "Film - BA"];
    expect(bestMatch("Accounting (B.A.C.)", candidates, (c) => c)).toBe("Accounting - BAC");
    expect(bestMatch("Egyptology (B.A.)", candidates, (c) => c)).toBeNull();
  });
});
