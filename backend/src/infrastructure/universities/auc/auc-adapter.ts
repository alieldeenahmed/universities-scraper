import { ScrapeError } from "../../../domain/errors";
import type { AdmissionRequirements, AdmissionSection } from "../../../domain/major";
import type { UniversityAdapter } from "../../../domain/ports/university-adapter";
import type { MajorReference, ScrapedMajor, ScrapeWarning } from "../../../domain/scraped-major";
import type { UniversityInfo } from "../../../domain/university";
import type { AdapterDeps } from "../adapter-deps";
import {
  parseBusinessAdmission,
  parseGeneralAdmission,
  parseSchoolAdmission,
  splitCatalogDescription,
  type BusinessAdmission,
} from "./admission-parsers";
import {
  AucCatalogClient,
  type CatalogHierarchy,
  type CatalogProgram,
  type CatalogProgramSummary,
} from "./catalog-client";
import { extractCreditHours } from "./credit-hours";
import { htmlToText } from "./html-text";
import { parseMainSitePrograms, type MainSiteProgram } from "./main-site-programs";
import { bestMatch, headingAppliesTo, slugify } from "./name-match";
import { buildTuition, parseUndergraduateRates, type ParsedRates } from "./tuition-parser";
import { PAGES } from "./urls";

export const AUC_INFO: UniversityInfo = {
  slug: "auc",
  name: "The American University in Cairo",
  country: "Egypt",
  website: "https://www.aucegypt.edu",
  // the catalog barely changes, and unchanged majors are skipped on incremental runs anyway
  schedule: { everyHours: 24 },
};

/** Bachelor's degrees that are actual majors. Drops minors, graduate programs and dual degrees. */
export function isUndergraduateMajor(program: CatalogProgramSummary): boolean {
  if (program.status?.active === false) return false;
  const isMajor = program.program_types.some((t) => t.name === "Major");
  const isBachelor = program.degree_types.some((d) => /^bachelor/i.test(d.name));
  return isMajor && isBachelor;
}

export class AucAdapter implements UniversityAdapter {
  readonly info = AUC_INFO;

  private readonly catalog: AucCatalogClient;
  private catalogId = 0;
  private readonly programIds = new Map<string, number>();
  private readonly hierarchies = new Map<number, CatalogHierarchy | null>();

  private mainSitePrograms: MainSiteProgram[] = [];
  private tuitionRates: ParsedRates | null = null;
  private generalAdmission: AdmissionSection[] = [];
  private scienceAdmission: AdmissionSection[] = [];
  private businessAdmission: BusinessAdmission | null = null;

  constructor(private readonly deps: AdapterDeps) {
    this.catalog = new AucCatalogClient(deps.http);
  }

  async prepare(): Promise<void> {
    // without a catalog nothing works, so this one is allowed to fail the run
    this.catalogId = await this.catalog.currentCatalogId();

    // the rest only enriches majors. A broken page shows up as a gap on the
    // affected fields and gets retried by the repair pass, it shouldn't stop the crawl.
    this.mainSitePrograms =
      (await this.optional("program list", async () => parseMainSitePrograms(await this.deps.http.getText(PAGES.programs)))) ?? [];

    this.tuitionRates = await this.optional("tuition", async () =>
      parseUndergraduateRates(await this.deps.http.getText(PAGES.tuition)),
    );

    this.generalAdmission =
      (await this.optional("general admission", async () =>
        parseGeneralAdmission(await this.deps.http.getText(PAGES.generalAdmission)),
      )) ?? [];

    this.scienceAdmission =
      (await this.optional("science admission", async () =>
        parseSchoolAdmission(await this.deps.http.getText(PAGES.scienceAdmission)),
      )) ?? [];

    this.businessAdmission = await this.optional("business admission", async () =>
      parseBusinessAdmission(await this.deps.http.getText(PAGES.businessAdmission)),
    );
  }

  async discover(): Promise<MajorReference[]> {
    const programs = (await this.catalog.listPrograms(this.catalogId)).filter(isUndergraduateMajor);

    this.programIds.clear();
    const refs: MajorReference[] = [];
    for (const program of programs) {
      let externalId = slugify(program.name);
      if (this.programIds.has(externalId)) externalId = `${externalId}-${program.id}`;
      this.programIds.set(externalId, program.id);

      refs.push({
        externalId,
        name: program.name,
        sourceUrl: this.publicUrl(program.name) ?? this.catalog.programUrl(this.catalogId, program.id),
        // a new catalog year changes the prefix, so every major is re-read once per year
        version: `${this.catalogId}:${program.modified ?? ""}`,
      });
    }
    return refs;
  }

  async scrape(ref: MajorReference): Promise<ScrapedMajor> {
    const programId = this.programIds.get(ref.externalId);
    if (programId == null) {
      throw new ScrapeError("unexpected", `${ref.externalId} was not part of this crawl's discovery`);
    }

    const program = await this.catalog.getProgram(this.catalogId, programId);
    const { overview, declaration } = splitCatalogDescription(program.description);
    const credits = extractCreditHours(htmlToText(program.description), program.cores.map((c) => c.name));
    const { faculty, department } = await this.affiliation(program, ref.name);

    const warnings: ScrapeWarning[] = [...credits.warnings];
    const schoolSections = this.schoolSpecificSections(program.name);
    const programSections: AdmissionSection[] = [];
    if (declaration) programSections.push(declaration);

    const needsSchoolRules = /sciences and engineering|business/i.test(faculty ?? "");
    if (needsSchoolRules && programSections.length === 0 && schoolSections.length === 0) {
      warnings.push({ field: "admissionRequirements", message: "no program specific admission requirements found" });
    }

    return {
      externalId: ref.externalId,
      name: program.name,
      degreeType: program.degree_types[0]?.name ?? null,
      faculty,
      department,
      description: overview || null,
      creditHours: credits.value,
      admissionRequirements: this.admission(ref.sourceUrl, [...programSections, ...schoolSections]),
      tuition: this.tuitionRates ? buildTuition(this.tuitionRates, credits.value, PAGES.tuition) : null,
      sourceUrl: ref.sourceUrl,
      sourceVersion: ref.version,
      warnings,
    };
  }

  private admission(sourceUrl: string, specific: AdmissionSection[]): AdmissionRequirements | null {
    const sections = [...specific, ...this.generalAdmission];
    if (sections.length === 0) return null;

    const sourceUrls = [sourceUrl];
    if (this.generalAdmission.length > 0) sourceUrls.push(PAGES.generalAdmission);
    if (specific.some((s) => s.title.startsWith("Minimum requirements"))) sourceUrls.push(PAGES.scienceAdmission);
    if (specific.some((s) => s.title.startsWith("Declaring a business major"))) sourceUrls.push(PAGES.businessAdmission);
    return { sections, sourceUrls: [...new Set(sourceUrls)] };
  }

  /** accordion blocks from the science page and the business page that apply to this program */
  private schoolSpecificSections(programName: string): AdmissionSection[] {
    const sections: AdmissionSection[] = [];

    for (const block of this.scienceAdmission) {
      if (headingAppliesTo(block.title, programName)) {
        sections.push({ title: `Minimum requirements by certificate (${block.title})`, body: block.body });
      }
    }

    const business = this.businessAdmission;
    if (business && business.programNames.some((name) => headingAppliesTo(name, programName))) {
      sections.push(business.section);
    }
    return sections;
  }

  private async affiliation(
    program: CatalogProgram,
    fallbackName: string,
  ): Promise<{ faculty: string | null; department: string | null }> {
    const deptParent = program.parents.find((p) => p.hierarchy_type === "Department");
    const schoolParent = program.parents.find((p) => p.hierarchy_type === "School");

    let faculty = schoolParent?.name ?? null;
    if (!faculty && deptParent) {
      const hierarchy = await this.hierarchy(deptParent.id);
      faculty = hierarchy?.parents.find((p) => p.hierarchy_type === "School")?.name ?? null;
    }
    // second opinion from the main site in case the hierarchy call failed
    faculty ??= this.mainSiteMatch(fallbackName)?.school ?? null;

    return { faculty, department: deptParent?.name ?? null };
  }

  private async hierarchy(id: number): Promise<CatalogHierarchy | null> {
    if (this.hierarchies.has(id)) return this.hierarchies.get(id) ?? null;
    const result = await this.optional(`department ${id}`, () => this.catalog.getHierarchy(this.catalogId, id));
    this.hierarchies.set(id, result);
    return result;
  }

  private mainSiteMatch(name: string): MainSiteProgram | null {
    const candidates = this.mainSitePrograms.filter((p) => p.degreeTypes.length > 0);
    return bestMatch(name, candidates, (p) => p.name);
  }

  private publicUrl(name: string): string | null {
    return this.mainSiteMatch(name)?.url ?? null;
  }

  private async optional<T>(what: string, load: () => Promise<T>): Promise<T | null> {
    try {
      return await load();
    } catch (err) {
      this.deps.logger.warn(`could not load ${what}`, { university: "auc", error: String(err) });
      return null;
    }
  }
}

export function createAucAdapter(deps: AdapterDeps): UniversityAdapter {
  return new AucAdapter(deps);
}
