import type { CSSProperties } from "react";
import type { MajorFacets } from "../../domain/major";

const PALETTE_SIZE = 8;
const FALLBACK = "var(--gray)";

/**
 * Faculties get a colour each, in the order the backend lists them (alphabetical),
 * so a university's colours are the same on every visit. More than eight
 * faculties start over from the first colour.
 */
export function facultyColors(facets: MajorFacets | undefined): Map<string, string> {
  const colors = new Map<string, string>();
  facets?.faculties.forEach((faculty, index) => {
    colors.set(faculty.name, `var(--fac-${(index % PALETTE_SIZE) + 1})`);
  });
  return colors;
}

export function colorOf(colors: Map<string, string>, faculty: string | null): string {
  return (faculty && colors.get(faculty)) || FALLBACK;
}

/** sets --c, which the stylesheet uses for stripes, markers, text and bars */
export function colorStyle(color: string): CSSProperties {
  return { ["--c" as string]: color };
}
