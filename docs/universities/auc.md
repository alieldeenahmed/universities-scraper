# AUC (American University in Cairo)

Notes from going through the site by hand before writing the adapter. Checked 30 Sep 2026.

## Where the data lives

AUC has two sites that matter:

- `www.aucegypt.edu` - Drupal marketing site. Program pages, admissions, tuition.
- `catalog.aucegypt.edu` - Acalog catalog. Has the real curriculum data.

### Bot protection

- `www.aucegypt.edu` answers plain HTTP requests normally (200, server rendered, no challenge). robots.txt only blocks admin/search/core paths, nothing under `/academics` or `/admissions`.
- `catalog.aucegypt.edu/content.php?...` (the normal catalog pages) sits behind an AWS WAF challenge. A plain request gets an empty `202` with `x-amzn-waf-action: challenge`. Its robots.txt also asks for a 120s crawl delay.
- We do **not** try to get past that challenge. Instead we use the catalog's Widget API (`/widget-api/...`), which AUC's own website calls from every visitor's browser to fill in the "Academic Requirements" links. It returns JSON, answers without a challenge, and is not covered by the robots.txt disallow list.

So no stealth browser is needed for this university. Everything is plain HTTP + JSON/HTML parsing.

## Sources used

| What | Where | Notes |
|---|---|---|
| Current catalog id | `GET catalog.aucegypt.edu/widget-api/catalogs/?type=default` | pick the one with `archived: false` (2026-2027 is id 32) |
| Program list | `GET /widget-api/catalog/{id}/programs/?page-size=100&page=N` | 177 programs (majors, minors, graduate). Each has `modified`, which we use to skip unchanged programs |
| Program detail | `GET /widget-api/catalog/{id}/program/{programId}/` | description (HTML), `parents` (department), `cores` (curriculum sections with credit counts) |
| Department -> school | `GET /widget-api/catalog/{id}/hierarchy/{hierarchyId}/` | `parents[0]` is the school |
| Tuition | `www.aucegypt.edu/admissions/tuition-and-financial-assistance` | flat rate per credit hour, see below |
| General admission | `www.aucegypt.edu/admissions/undergraduate-requirements` | applies to every undergraduate program |
| Sciences and Engineering admission | `.../undergraduate-requirements/sciences-and-engineering-programs` | accordion, one item per program, per-certificate rules |
| Business admission | `.../undergraduate-requirements/business-programs` | accordion, same markup |

The main site's `/academics/programs` page also embeds the whole program list as JSON inside an Alpine `x-data` attribute (types, schools, areas, programs). We don't depend on it, but it is a handy second opinion on which programs are undergraduate majors.

## What counts as an undergraduate major

From the catalog list: `program_types` contains `Major` and the degree type starts with `Bachelor`. That gives 36 programs today. The main site lists 37 (it also has a political science honors entry). Minors, graduate programs and the two dual degree entries are excluded.

## Field mapping

| Wanted | Extracted from |
|---|---|
| Faculty | school name from the department's hierarchy entry |
| Department | `parents[]` with `hierarchy_type = Department` |
| Description | `description` HTML, cleaned to text |
| Credit hours | see below |
| Admission requirements | catalog description (declaration policy section), school page accordion, general page |
| Tuition | credit hours x per-credit-hour rate |

### Credit hours

Most descriptions say it outright: "A total of 120 credits is required...", "a minimum of 120 credit hours", "a total of 132 credits". That is the primary source. The fallback is adding up the top level curriculum sections whose name carries a count, like `Core Curriculum (33 credits)`.

Summing alone is not safe. Checked against all 36 majors: Film summed to 46, Arabic Studies to 76, Economics to 102 because some sections have no count or use ranges (`48 - 51 credits`). When both numbers exist and disagree, the stated total wins and we log a gap so somebody can look.

### Tuition

One flat rate for every undergraduate program: $700 per credit hour for Egyptian students, $735 for international students. So tuition per major is just credit hours times rate, and the rate is scraped from the tuition page rather than hardcoded. If the page layout changes and the rate can't be read, the tuition field is left empty and a gap is recorded.

### Admission requirements

Layered, because AUC does it that way:

1. General requirements (deadlines, documents, English proficiency) - same for everyone.
2. School level: Sciences and Engineering and Business publish per-program, per-certificate rules. The other two schools declare majors after enrollment.
3. Program level: the catalog description has a "Declaration Policy" / "Declaration of the ... Major" part with the actual criteria.

## Things to keep an eye on

- The catalog year changes every summer, so the catalog id is looked up on every run instead of being hardcoded.
- The S&E and Business pages use program names that don't match the catalog exactly ("Actuarial Science" vs "Actuarial Science (B.S.)"), so they are matched on a normalised base name.
- A few program names are very long ("Computer Science with specializations in ..."), use the catalog `id` as the stable key, not the name.
