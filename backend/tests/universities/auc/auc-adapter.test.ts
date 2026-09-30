import { beforeEach, describe, expect, it } from "vitest";
import { ScrapeError } from "../../../src/domain/errors";
import type { MajorReference } from "../../../src/domain/scraped-major";
import { assessMajor } from "../../../src/domain/rules/assess-major";
import { AucAdapter, cleanDegreeType, isUndergraduateMajor } from "../../../src/infrastructure/universities/auc/auc-adapter";
import { PAGES } from "../../../src/infrastructure/universities/auc/urls";
import { aucHttp } from "../../support/auc-http";
import { fixtureJson } from "../../support/fixtures";
import { SilentLogger } from "../../support/silent-logger";
import type { FakeHttp } from "../../support/fake-http";

function makeAdapter(http: FakeHttp = aucHttp()) {
  const logger = new SilentLogger();
  return { adapter: new AucAdapter({ http, logger }), http, logger };
}

async function ready(http?: FakeHttp) {
  const made = makeAdapter(http);
  await made.adapter.prepare();
  const refs = await made.adapter.discover();
  return { ...made, refs };
}

const byName = (refs: MajorReference[], start: string) => refs.find((r) => r.name.startsWith(start))!;

describe("isUndergraduateMajor", () => {
  const programs = fixtureJson("auc/programs-page1.json")["program-list"];

  it("keeps bachelor majors and drops minors and graduate programs", () => {
    const kept = programs.filter(isUndergraduateMajor).map((p: any) => p.name);
    expect(kept).toHaveLength(8);
    expect(kept).toContain("Film (B.A.)");
    expect(kept).not.toContain("Accounting Minor");
    expect(kept).not.toContain("Computer Science (M.Sc.)");
  });
});

describe("cleanDegreeType", () => {
  it("drops the trailing abbreviation some degree names carry", () => {
    expect(cleanDegreeType("Bachelor of Business in Finance (B.B.F.)")).toBe("Bachelor of Business in Finance");
    expect(cleanDegreeType("Bachelor of Science")).toBe("Bachelor of Science");
  });

  it("returns null for nothing", () => {
    expect(cleanDegreeType(undefined)).toBeNull();
    expect(cleanDegreeType("  ")).toBeNull();
  });
});

describe("AucAdapter.discover", () => {
  it("lists the undergraduate majors with stable ids, public urls and versions", async () => {
    const { refs } = await ready();
    expect(refs).toHaveLength(8);

    const cs = byName(refs, "Computer Science with");
    expect(cs.externalId).toBe("computer-science-with-specializations-in-embedded-systems-artificial-intelligence-and-cybersecurity");
    expect(cs.sourceUrl).toBe("https://www.aucegypt.edu/academics/undergraduate-programs/computer-science");
    expect(cs.version).toMatch(/^32:\d{4}-\d{2}-\d{2}/);
  });

  it("falls back to the catalog api url when the main site has no match", async () => {
    const { refs } = await ready();
    const arabic = byName(refs, "Arabic Studies");
    expect(arabic.sourceUrl).toBe("https://catalog.aucegypt.edu/widget-api/catalog/32/program/4880/");
  });
});

describe("AucAdapter.scrape", () => {
  let refs: MajorReference[];
  let adapter: AucAdapter;
  let http: FakeHttp;

  beforeEach(async () => {
    ({ refs, adapter, http } = await ready());
  });

  it("builds a complete major for computer science", async () => {
    const major = await adapter.scrape(byName(refs, "Computer Science with"));

    expect(major).toMatchObject({
      degreeType: "Bachelor of Science",
      faculty: "School of Sciences and Engineering",
      department: "Department of Computer Science and Engineering",
      creditHours: 130,
    });
    expect(major.description).toContain("Bachelor of Science in Computer Science");
    expect(major.tuition?.estimatedTotals).toEqual([
      { label: "Egyptian students", amount: 91000 },
      { label: "International students", amount: 95550 },
    ]);
    expect(assessMajor(major)).toEqual([]);
  });

  it("layers program, school and general admission requirements", async () => {
    const major = await adapter.scrape(byName(refs, "Computer Science with"));
    const titles = major.admissionRequirements!.sections.map((s) => s.title);
    expect(titles).toEqual([
      "Declaration of the Computer Science Major",
      "Minimum requirements by certificate (Computer Science)",
      "Application deadlines",
      "General admission requirements",
      "English language requirements",
      "Declaring a major at admission",
    ]);
    expect(major.admissionRequirements!.sourceUrls).toEqual([
      "https://www.aucegypt.edu/academics/undergraduate-programs/computer-science",
      PAGES.generalAdmission,
      PAGES.scienceAdmission,
    ]);
  });

  it("uses the engineering block for engineering majors", async () => {
    const major = await adapter.scrape(byName(refs, "Computer Engineering"));
    const titles = major.admissionRequirements!.sections.map((s) => s.title);
    expect(titles).toContain("Minimum requirements by certificate (Engineering Programs)");
    expect(titles).not.toContain("Minimum requirements by certificate (Computer Science)");
  });

  it("adds the business rules to business majors", async () => {
    const major = await adapter.scrape(byName(refs, "Accounting"));
    expect(major.faculty).toBe("Onsi Sawiris School of Business");
    expect(major.department).toBe("Youssef Nabih Department of Accounting");
    expect(major.creditHours).toBe(127);
    const titles = major.admissionRequirements!.sections.map((s) => s.title);
    expect(titles).toContain("Declaring a business major at admission");
  });

  it("reads the stated credit hours even when the sections don't add up", async () => {
    // film's sections sum to 46, arabic studies' to 76, economics' to 102
    expect((await adapter.scrape(byName(refs, "Film"))).creditHours).toBe(120);
    expect((await adapter.scrape(byName(refs, "Arabic Studies"))).creditHours).toBe(120);
    expect((await adapter.scrape(byName(refs, "Economics"))).creditHours).toBe(120);
  });

  it("works for humanities majors that have no school specific rules", async () => {
    const film = await adapter.scrape(byName(refs, "Film"));
    expect(film.faculty).toBe("School of Humanities and Social Sciences");
    expect(film.department).toBe("Department of the Arts");
    expect(film.admissionRequirements!.sections[0]?.title).toBe("Declaration Policy");
    expect(assessMajor(film)).toEqual([]);
  });

  it("gives every fixture major a faculty, department, credit hours and admission rules", async () => {
    for (const ref of refs) {
      const major = await adapter.scrape(ref);
      expect(major.faculty, ref.name).toBeTruthy();
      expect(major.department, ref.name).toBeTruthy();
      expect(major.creditHours, ref.name).toBeGreaterThanOrEqual(90);
      expect(major.admissionRequirements?.sections.length, ref.name).toBeGreaterThan(0);
    }
    // departments are fetched once each, not once per major
    const hierarchyCalls = http.requests.filter((u) => u.includes("/hierarchy/"));
    expect(new Set(hierarchyCalls).size).toBe(hierarchyCalls.length);
  });

  it("refuses a reference that discovery never produced", async () => {
    const stray: MajorReference = { externalId: "nope", name: "Nope", sourceUrl: "x", version: null };
    await expect(adapter.scrape(stray)).rejects.toMatchObject({ kind: "unexpected" });
  });
});

describe("AucAdapter when a source misbehaves", () => {
  it("fails the run when there is no catalog to read", async () => {
    const http = aucHttp().override(
      "https://catalog.aucegypt.edu/widget-api/catalogs/?type=default",
      new ScrapeError("blocked", "challenge"),
    );
    const { adapter } = makeAdapter(http);
    await expect(adapter.prepare()).rejects.toMatchObject({ kind: "blocked" });
  });

  it("keeps going without tuition and reports it as a gap", async () => {
    const http = aucHttp().override(PAGES.tuition, new ScrapeError("transient", "HTTP 503"));
    const { adapter, refs, logger } = await ready(http);

    const major = await adapter.scrape(byName(refs, "Computer Science with"));
    expect(major.tuition).toBeNull();
    expect(major.creditHours).toBe(130);
    expect(assessMajor(major).map((g) => g.field)).toEqual(["tuition"]);
    expect(logger.entries.some((e) => e.level === "warn" && e.message.includes("tuition"))).toBe(true);
  });

  it("keeps going when the school page changed and warns for science and business majors", async () => {
    const http = aucHttp().override(PAGES.scienceAdmission, "<html><body><p>moved</p></body></html>");
    const { adapter, refs } = await ready(http);

    // computer science still has its catalog declaration section
    const cs = await adapter.scrape(byName(refs, "Computer Science with"));
    expect(cs.warnings).toEqual([]);
    expect(cs.admissionRequirements!.sections.map((s) => s.title)).not.toContain(
      "Minimum requirements by certificate (Computer Science)",
    );
  });

  it("falls back to the main site for the faculty when a department lookup fails", async () => {
    const http = aucHttp().override(/\/hierarchy\/1400\/$/, new ScrapeError("transient", "HTTP 500"));
    const { adapter, refs } = await ready(http);

    const cs = await adapter.scrape(byName(refs, "Computer Science with"));
    expect(cs.department).toBe("Department of Computer Science and Engineering");
    expect(cs.faculty).toBe("School of Sciences and Engineering");
  });

  it("fails a single major, not the crawl, when its detail is malformed", async () => {
    const http = aucHttp().override(/\/program\/4880\/$/, { id: 4880, name: 42 });
    const { adapter, refs } = await ready(http);

    await expect(adapter.scrape(byName(refs, "Arabic Studies"))).rejects.toMatchObject({ kind: "parse" });
    await expect(adapter.scrape(byName(refs, "Film"))).resolves.toBeTruthy();
  });
});
