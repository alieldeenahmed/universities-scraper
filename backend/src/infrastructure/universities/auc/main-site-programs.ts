import * as cheerio from "cheerio";

export interface MainSiteProgram {
  name: string;
  school: string | null;
  degreeTypes: string[];
  /** absolute url of the program page, when the entry links to one */
  url: string | null;
}

const SITE = "https://www.aucegypt.edu";

/** Reads a balanced [...] starting at `start`, skipping over brackets inside strings. */
function readArray(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i += 1;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function arrayFor<T>(xData: string, key: string): T[] | null {
  const at = xData.indexOf(`${key}: [`);
  if (at === -1) return null;
  const raw = readArray(xData, at + key.length + 2);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return null;
  }
}

interface RawProgram {
  name: string;
  types: string[];
  school: string;
  links?: Array<{ href?: string; innerHTML?: string }>;
}

/**
 * The all-programs page keeps its whole dataset in an Alpine `x-data` attribute
 * (types, schools, programs). Returns null when that shape isn't there any more.
 */
export function parseMainSitePrograms(html: string): MainSiteProgram[] | null {
  const $ = cheerio.load(html);
  const xData = $("[x-data]")
    .toArray()
    .map((el) => $(el).attr("x-data") ?? "")
    .find((value) => value.includes("programs: ["));
  if (!xData) return null;

  const types = arrayFor<{ id: string; name: string }>(xData, "types");
  const schools = arrayFor<{ id: string; name: string }>(xData, "schools");
  const programs = arrayFor<RawProgram>(xData, "programs");
  if (!types || !schools || !programs) return null;

  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const schoolName = new Map(schools.map((s) => [s.id, s.name]));

  return programs.map((program) => {
    const details = program.links?.find((l) => /program details/i.test(l.innerHTML ?? ""));
    const href = details?.href;
    return {
      name: program.name,
      school: schoolName.get(program.school) ?? null,
      degreeTypes: program.types.map((id) => typeName.get(id)).filter((n): n is string => Boolean(n)),
      url: href ? (href.startsWith("http") ? href : SITE + href) : null,
    };
  });
}
