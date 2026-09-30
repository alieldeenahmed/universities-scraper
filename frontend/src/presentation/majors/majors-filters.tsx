import { useEffect, useState } from "react";
import { changeFaculty, clearFilters, departmentOptions, hasActiveFilters } from "../../application/filters";
import type { MajorFacets, MajorFilter } from "../../domain/major";

interface Props {
  filter: MajorFilter;
  facets: MajorFacets | undefined;
  onChange: (filter: MajorFilter) => void;
}

const SEARCH_DELAY_MS = 250;
const EMPTY_FACETS: MajorFacets = { faculties: [], degreeTypes: [] };

export function MajorsFilters({ filter, facets = EMPTY_FACETS, onChange }: Props) {
  // the box keeps what is being typed, the filter only changes once typing pauses
  const [typed, setTyped] = useState(filter.search ?? "");

  useEffect(() => setTyped(filter.search ?? ""), [filter.search]);

  useEffect(() => {
    if (typed.trim() === (filter.search ?? "")) return;
    const timer = setTimeout(() => onChange({ ...filter, search: typed.trim() || undefined }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed, filter, onChange]);

  return (
    <div className="filters">
      <input
        type="search"
        placeholder="Search majors, departments, descriptions"
        aria-label="Search majors"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />

      <select
        aria-label="Faculty"
        value={filter.faculty ?? ""}
        onChange={(e) => onChange(changeFaculty(filter, e.target.value, facets))}
      >
        <option value="">All faculties</option>
        {facets.faculties.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Department"
        value={filter.department ?? ""}
        onChange={(e) => onChange({ ...filter, department: e.target.value || undefined })}
      >
        <option value="">All departments</option>
        {departmentOptions(facets, filter.faculty).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <select
        aria-label="Degree"
        value={filter.degreeType ?? ""}
        onChange={(e) => onChange({ ...filter, degreeType: e.target.value || undefined })}
      >
        <option value="">All degrees</option>
        {facets.degreeTypes.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="btn"
        disabled={!hasActiveFilters(filter)}
        onClick={() => onChange(clearFilters(filter))}
      >
        Clear
      </button>
    </div>
  );
}
