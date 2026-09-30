import type { GapObservation } from "../gap";
import type { ScrapedMajor } from "../scraped-major";

/** a bachelor's degree outside this range is almost certainly a parsing slip */
export const CREDIT_HOURS_RANGE = { min: 90, max: 200 } as const;

const MIN_DESCRIPTION_LENGTH = 80;

function missing(field: string, detail: string): GapObservation {
  return { kind: "missing_field", field, detail };
}

/** Everything that looks off about a freshly scraped major. Empty list = complete. */
export function assessMajor(major: ScrapedMajor): GapObservation[] {
  const gaps: GapObservation[] = [];

  if (!major.faculty) gaps.push(missing("faculty", "no faculty/school found"));
  if (!major.department) gaps.push(missing("department", "no department found"));

  const description = major.description?.trim() ?? "";
  if (description.length === 0) {
    gaps.push(missing("description", "description is empty"));
  } else if (description.length < MIN_DESCRIPTION_LENGTH) {
    gaps.push({
      kind: "suspect_value",
      field: "description",
      detail: `description is only ${description.length} characters`,
    });
  }

  if (major.creditHours == null) {
    gaps.push(missing("creditHours", "credit hours could not be determined"));
  } else if (
    major.creditHours < CREDIT_HOURS_RANGE.min ||
    major.creditHours > CREDIT_HOURS_RANGE.max
  ) {
    gaps.push({
      kind: "suspect_value",
      field: "creditHours",
      detail: `${major.creditHours} credit hours is outside ${CREDIT_HOURS_RANGE.min}-${CREDIT_HOURS_RANGE.max}`,
    });
  }

  if (!major.admissionRequirements || major.admissionRequirements.sections.length === 0) {
    gaps.push(missing("admissionRequirements", "no admission requirements found"));
  }

  if (!major.tuition || major.tuition.rates.length === 0) {
    gaps.push(missing("tuition", "no tuition information found"));
  }

  for (const warning of major.warnings) {
    gaps.push({ kind: "suspect_value", field: warning.field, detail: warning.message });
  }

  return gaps;
}
