import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { AdmissionSection } from "../../../domain/major";
import { nodesToText } from "./html-text";

const MAX_SECTION_LENGTH = 6000;

function clip(text: string): string {
  if (text.length <= MAX_SECTION_LENGTH) return text;
  const cut = text.lastIndexOf("\n", MAX_SECTION_LENGTH);
  return text.slice(0, cut > 0 ? cut : MAX_SECTION_LENGTH).trimEnd();
}

function cleanHeading(text: string): string {
  return text.replace(/\s+/g, " ").replace(/:$/, "").trim();
}

/** Walks the children of `container`, starting a new section at every heading. */
function sectionsByHeading(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<AnyNode>,
  isHeading: (el: AnyNode) => string | null,
): AdmissionSection[] {
  const sections: AdmissionSection[] = [];
  let current: { title: string; nodes: AnyNode[] } | null = null;

  const flush = () => {
    if (!current) return;
    const body = nodesToText(current.nodes);
    if (body) sections.push({ title: current.title, body: clip(body) });
  };

  container.children().each((_, el) => {
    const title = isHeading(el);
    if (title) {
      flush();
      current = { title, nodes: [] };
    } else if (current) {
      current.nodes.push(el);
    }
  });
  flush();
  return sections;
}

const H_TAG = /^h[1-6]$/i;

const GENERAL_TITLES: Array<[RegExp, string]> = [
  [/requirements for all certificates/i, "General admission requirements"],
  [/english language/i, "English language requirements"],
  [/declaring a major upon admission/i, "Declaring a major at admission"],
];

/** General undergraduate admission page: deadlines plus the sections that apply to every applicant. */
export function parseGeneralAdmission(html: string): AdmissionSection[] {
  const $ = cheerio.load(html);
  const sections: AdmissionSection[] = [];

  const deadlines = $(".important-dates__item")
    .map((_, el) => {
      const day = $(el).find(".important-dates__item-date-day").text().trim();
      const month = $(el).find(".important-dates__item-date-month").text().trim();
      const term = $(el).find(".important-dates__item-heading").text().trim();
      return day && month && term ? `${term}: ${day} ${month}` : null;
    })
    .get();
  if (deadlines.length > 0) sections.push({ title: "Application deadlines", body: deadlines.join("\n") });

  const firstHeading = $(".wysiwyg h3").first();
  if (firstHeading.length > 0) {
    const all = sectionsByHeading($, firstHeading.parent(), (el) =>
      el.type === "tag" && H_TAG.test(el.name) ? cleanHeading($(el).text()) || null : null,
    );
    for (const section of all) {
      const known = GENERAL_TITLES.find(([pattern]) => pattern.test(section.title));
      if (known) sections.push({ title: known[1], body: section.body });
    }
  }
  return sections;
}

/** Sciences and Engineering page: one accordion item per program (or group of programs). */
export function parseSchoolAdmission(html: string): AdmissionSection[] {
  const $ = cheerio.load(html);
  const sections: AdmissionSection[] = [];

  $(".accordion__item").each((_, el) => {
    const title = cleanHeading($(el).find(".accordion__item-heading").first().text());
    const panel = $(el).find(".accordion__panel-inner").first();
    const body = nodesToText(panel.contents().toArray());
    if (title && body) sections.push({ title, body: clip(body) });
  });
  return sections;
}

export interface BusinessAdmission {
  programNames: string[];
  section: AdmissionSection;
}

/** Business page: a list of the programs it covers, then the selection criteria in plain paragraphs. */
export function parseBusinessAdmission(html: string): BusinessAdmission | null {
  const $ = cheerio.load(html);
  const list = $("main .wysiwyg ul").first();
  if (list.length === 0) return null;

  const programNames = list
    .find("li a")
    .map((_, a) => cleanHeading($(a).text()))
    .get()
    .filter(Boolean);
  if (programNames.length === 0) return null;

  const rest = list.nextAll().toArray();
  const body = nodesToText(rest);
  if (!body) return null;

  return {
    programNames,
    section: { title: "Declaring a business major at admission", body: clip(body) },
  };
}

export interface CatalogDescription {
  /** everything before the declaration / degree requirements part */
  overview: string;
  declaration: AdmissionSection | null;
}

const DECLARATION_START = /declar|admission|admit|eligib|entry requirement/i;
// where the curriculum part begins. Ends both the overview and the declaration section.
const REQUIREMENTS_START =
  /degree requirements|course requirements|requirements for (the )?(degree|major)|\bminor\b|core curriculum|curriculum/i;
// objectives and outcomes belong to the overview, but they also end a declaration section
// if they happen to come after it
const DECLARATION_END = new RegExp(`${REQUIREMENTS_START.source}|program (learning )?(outcomes|objectives)`, "i");

const MAX_OVERVIEW_LENGTH = 5000;

/**
 * Catalog descriptions are one long HTML blob: overview, objectives and
 * outcomes, then "Declaration Policy" (who may enter the major) and "Degree
 * Requirements". A heading is a real heading tag or a paragraph that is only
 * bold text, which is how most of these were written.
 */
export function splitCatalogDescription(html: string): CatalogDescription {
  const $ = cheerio.load(`<div id="root">${html}</div>`, {}, false);
  let kids = $("#root").children().toArray();
  if (kids.length === 1 && kids[0]?.type === "tag" && kids[0].name === "div") {
    kids = $(kids[0]).children().toArray();
  }

  const headingText = (el: AnyNode): string | null => {
    if (el.type !== "tag") return null;
    const text = cleanHeading($(el).text());
    if (!text || text.length > 140) return null;
    if (H_TAG.test(el.name)) return text;
    const strong = $(el).children("strong, b");
    if (strong.length > 0 && cleanHeading(strong.text()) === text) return text;
    return null;
  };

  const headings = kids.map((el, index) => ({ index, text: headingText(el) })).filter((h) => h.text);
  const start = headings.find((h) => DECLARATION_START.test(h.text!));
  const firstBoundary = headings.find((h) => DECLARATION_START.test(h.text!) || REQUIREMENTS_START.test(h.text!));

  const overviewEnd = firstBoundary ? firstBoundary.index : kids.length;
  let overview = nodesToText(kids.slice(0, overviewEnd));
  if (overview.length < 80) overview = nodesToText(kids);
  if (overview.length > MAX_OVERVIEW_LENGTH) {
    const cut = overview.lastIndexOf("\n", MAX_OVERVIEW_LENGTH);
    overview = overview.slice(0, cut > 0 ? cut : MAX_OVERVIEW_LENGTH).trimEnd();
  }

  if (!start) return { overview, declaration: null };

  const end = headings.find((h) => h.index > start.index && DECLARATION_END.test(h.text!));
  const body = nodesToText(kids.slice(start.index + 1, end ? end.index : kids.length));
  return {
    overview,
    declaration: body ? { title: start.text!, body: clip(body) } : null,
  };
}
