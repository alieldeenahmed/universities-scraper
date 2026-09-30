import type { MajorFacets, MajorFilter } from "../domain/major";

/** Departments that can be picked. With a faculty chosen only its own departments, otherwise all of them. */
export function departmentOptions(facets: MajorFacets, faculty: string | undefined): string[] {
  const relevant = faculty ? facets.faculties.filter((f) => f.name === faculty) : facets.faculties;
  return [...new Set(relevant.flatMap((f) => f.departments))].sort((a, b) => a.localeCompare(b));
}

/**
 * Changing the faculty drops a department that doesn't belong to it anymore,
 * otherwise the table would silently filter by something the dropdown no longer shows.
 */
export function changeFaculty(filter: MajorFilter, faculty: string | undefined, facets: MajorFacets): MajorFilter {
  const next: MajorFilter = { ...filter, faculty: faculty || undefined };
  if (next.department && !departmentOptions(facets, next.faculty).includes(next.department)) {
    next.department = undefined;
  }
  return next;
}

export function hasActiveFilters(filter: MajorFilter): boolean {
  return Boolean(filter.faculty || filter.department || filter.degreeType || filter.search);
}

/** a fresh filter that keeps only the selected university */
export function clearFilters(filter: MajorFilter): MajorFilter {
  return { universityId: filter.universityId };
}
