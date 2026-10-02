import { useEffect, useState } from "react";
import { changeFaculty, clearFilters, departmentOptions, hasActiveFilters } from "../../application/filters";
import type { MajorFacets, MajorFilter } from "../../domain/major";
import { Dropdown } from "../components/dropdown";
import { IconSearch } from "../components/icons";
import { Marker } from "../components/marker";
import { colorOf, colorStyle } from "../theme/faculty-colors";

interface Props {
  filter: MajorFilter;
  facets: MajorFacets | undefined;
  colors: Map<string, string>;
  /** how many majors the current filters match, shown at the right. Left out until known. */
  count: number | undefined;
  onChange: (filter: MajorFilter) => void;
}

const SEARCH_DELAY_MS = 250;
const EMPTY_FACETS: MajorFacets = { faculties: [], degreeTypes: [] };

export function MajorsFilters({ filter, facets = EMPTY_FACETS, colors, count, onChange }: Props) {
  // the box keeps what is being typed, the filter only changes once typing pauses
  const [typed, setTyped] = useState(filter.search ?? "");

  useEffect(() => setTyped(filter.search ?? ""), [filter.search]);

  useEffect(() => {
    if (typed.trim() === (filter.search ?? "")) return;
    const timer = setTimeout(() => onChange({ ...filter, search: typed.trim() || undefined }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed, filter, onChange]);

  return (
    <div>
      <div className="search">
        <IconSearch size={19} />
        <input
          type="search"
          placeholder="Search majors, departments, descriptions"
          aria-label="Search majors"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>

      <div className="chips" role="group" aria-label="Faculty">
        <button
          type="button"
          className="chip"
          aria-pressed={!filter.faculty}
          onClick={() => onChange(changeFaculty(filter, undefined, facets))}
        >
          All faculties
        </button>
        {facets.faculties.map((faculty) => {
          const selected = filter.faculty === faculty.name;
          return (
            <button
              key={faculty.name}
              type="button"
              className="chip"
              style={colorStyle(colorOf(colors, faculty.name))}
              aria-pressed={selected}
              onClick={() => onChange(changeFaculty(filter, selected ? undefined : faculty.name, facets))}
            >
              <Marker shape="square" />
              {faculty.name}
            </button>
          );
        })}
      </div>

      <div className="filter-row">
        <Dropdown
          label="Department"
          value={filter.department ?? ""}
          options={[
            { value: "", label: "All departments" },
            ...departmentOptions(facets, filter.faculty).map((department) => ({ value: department, label: department })),
          ]}
          onChange={(department) => onChange({ ...filter, department: department || undefined })}
        />

        <Dropdown
          label="Degree"
          value={filter.degreeType ?? ""}
          options={[
            { value: "", label: "All degrees" },
            ...facets.degreeTypes.map((degree) => ({ value: degree, label: degree })),
          ]}
          onChange={(degree) => onChange({ ...filter, degreeType: degree || undefined })}
        />

        <button
          type="button"
          className="link-button"
          disabled={!hasActiveFilters(filter)}
          onClick={() => onChange(clearFilters(filter))}
        >
          Clear filters
        </button>

        {count !== undefined && (
          <span className="count" data-testid="result-count" aria-live="polite">
            <strong>{count}</strong> major{count === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
