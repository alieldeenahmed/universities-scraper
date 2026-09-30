import type { ScrapeWarning } from "../../../domain/scraped-major";

export interface CreditHoursResult {
  value: number | null;
  source: "stated" | "sections" | null;
  warnings: ScrapeWarning[];
}

const PLAUSIBLE = { min: 90, max: 200 };
const CREDITS = /(\d{2,3})\s*(?:credits?|credit[\s-]hours?)/gi;

/**
 * The description usually says it outright ("A total of 120 credits is required
 * for the bachelor's degree"), so look for a sentence that talks about the whole
 * degree. Sentences about a single requirement ("a minimum of 27 credit hours
 * including ECON 2011") are ignored because they never mention the degree.
 */
export function findStatedTotal(descriptionText: string): number | null {
  const sentences = descriptionText.split(/(?<=[.!?])\s+|\n+/);
  let fallback: number | null = null;

  for (const sentence of sentences) {
    if (!/\b(bachelor|degree|b\.?\s?(?:a|s|sc|arch)\b)/i.test(sentence)) continue;
    if (!/\b(total|minimum|required|require)\b/i.test(sentence)) continue;

    for (const match of sentence.matchAll(CREDITS)) {
      const value = Number(match[1]);
      if (value < PLAUSIBLE.min || value > PLAUSIBLE.max) continue;
      if (/\btotal\b/i.test(sentence)) return value;
      fallback ??= value;
    }
  }
  return fallback;
}

interface SectionCredits {
  /** sum of the sections that state an exact number */
  exactSum: number;
  /** some section had no number or a range, so the sum can't be trusted as a total */
  complete: boolean;
}

/** "Core Curriculum (33 credits)" -> 33. Ranges like "(48 - 51 credits)" and sections without a count make the sum incomplete. */
export function sumSections(sectionNames: string[]): SectionCredits {
  let exactSum = 0;
  let complete = sectionNames.length > 0;

  for (const name of sectionNames) {
    const range = /\((\d+)\s*(?:-|to|or)\s*(\d+)\s*credits?\)/i.exec(name);
    if (range) {
      complete = false;
      continue;
    }
    const exact = /\((\d+)\s*credits?(?:\s*hours?)?\)/i.exec(name);
    if (exact) exactSum += Number(exact[1]);
    else complete = false;
  }
  return { exactSum, complete };
}

export function extractCreditHours(descriptionText: string, topLevelSectionNames: string[]): CreditHoursResult {
  const stated = findStatedTotal(descriptionText);
  const sections = sumSections(topLevelSectionNames);
  const warnings: ScrapeWarning[] = [];

  if (stated != null) {
    // a clean, fully counted breakdown that disagrees with the stated total is worth a look
    if (sections.complete && Math.abs(sections.exactSum - stated) > 3) {
      warnings.push({
        field: "creditHours",
        message: `description says ${stated} credits but the sections add up to ${sections.exactSum}`,
      });
    }
    return { value: stated, source: "stated", warnings };
  }

  if (sections.exactSum >= PLAUSIBLE.min && sections.exactSum <= PLAUSIBLE.max) {
    warnings.push({
      field: "creditHours",
      message: `no total in the description, using the sum of the sections (${sections.exactSum})`,
    });
    return { value: sections.exactSum, source: "sections", warnings };
  }

  return { value: null, source: null, warnings };
}
