export const SITE = "https://www.aucegypt.edu";

// The catalog's own pages (content.php, preview_program.php) sit behind a bot
// challenge. The widget api is what AUC's website itself calls, so it is used instead.
export const CATALOG_API = "https://catalog.aucegypt.edu/widget-api";

export const PAGES = {
  programs: `${SITE}/academics/programs`,
  tuition: `${SITE}/admissions/tuition-and-financial-assistance`,
  generalAdmission: `${SITE}/admissions/undergraduate-requirements`,
  scienceAdmission: `${SITE}/admissions/undergraduate-requirements/sciences-and-engineering-programs`,
  businessAdmission: `${SITE}/admissions/undergraduate-requirements/business-programs`,
} as const;
