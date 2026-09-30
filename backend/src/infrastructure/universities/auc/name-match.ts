/** lowercase words only: "Computer Science, with ... (B.S.)" -> "computer science with ... bs" */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** the name without its degree tag: "Actuarial Science (B.S.)" -> "actuarial science" */
export function baseName(name: string): string {
  return normalizeName(name.replace(/\([^)]*\)/g, " "));
}

export function slugify(name: string): string {
  return baseName(name).replace(/ /g, "-").slice(0, 100).replace(/-+$/, "");
}

/**
 * The admission pages title their blocks with short names ("Computer Science",
 * "Engineering Programs"), the catalog uses long ones ("Computer Science with
 * specializations in ..."). A heading applies when it is the start of the name.
 */
export function headingAppliesTo(heading: string, programName: string): boolean {
  const h = baseName(heading);
  const base = baseName(programName);
  if (!h || !base) return false;
  if (h === "engineering programs") return /\bengineering\b/.test(base);
  return base === h || base.startsWith(`${h} `);
}

function tokens(name: string): Set<string> {
  return new Set(normalizeName(name).split(" ").filter(Boolean));
}

/** 0..1, how much two program names overlap. Good enough to pair the same program on two sites. */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

/** finds the candidate that is the same program as `name`, or null when nothing is close enough */
export function bestMatch<T>(name: string, candidates: T[], nameOf: (c: T) => string, minScore = 0.8): T | null {
  const exact = normalizeName(name);
  let best: T | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const candidateName = nameOf(candidate);
    if (normalizeName(candidateName) === exact) return candidate;
    const score = similarity(name, candidateName);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore >= minScore ? best : null;
}
