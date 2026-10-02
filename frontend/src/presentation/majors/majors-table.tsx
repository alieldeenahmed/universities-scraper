import { formatCredits, formatMoney } from "../../domain/format";
import {
  primaryTuition,
  type MajorSortKey,
  type MajorSummary,
  type SortDirection,
} from "../../domain/major";
import { IconChevronDown, IconChevronUp } from "../components/icons";
import { Marker } from "../components/marker";
import { colorOf, colorStyle } from "../theme/faculty-colors";

export interface Sort {
  key: MajorSortKey;
  direction: SortDirection;
}

interface Props {
  majors: MajorSummary[];
  colors: Map<string, string>;
  sort: Sort;
  onSort: (key: MajorSortKey) => void;
  onOpen: (id: number) => void;
}

const COLUMNS: Array<{ key: MajorSortKey; label: string; numeric?: boolean }> = [
  { key: "name", label: "Major" },
  { key: "faculty", label: "Faculty" },
  { key: "degreeType", label: "Degree" },
  { key: "creditHours", label: "Credits", numeric: true },
  { key: "tuition", label: "Est. tuition", numeric: true },
];

function ariaSort(sort: Sort, key: MajorSortKey): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

/** a number with a thin bar under it, as long as the number is compared to the biggest one on screen */
function Measure({ text, value, max }: { text: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="measure">
      <span>{text}</span>
      <span className="bar" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </span>
    </div>
  );
}

export function MajorsTable({ majors, colors, sort, onSort, onOpen }: Props) {
  const maxCredits = Math.max(0, ...majors.map((m) => m.creditHours ?? 0));
  const maxTuition = Math.max(0, ...majors.map((m) => primaryTuition(m)?.amount ?? 0));

  return (
    <div className="table-card">
      <table className="majors-table">
        <colgroup>
          <col className="col-major" />
          <col className="col-faculty" />
          <col className="col-degree" />
          <col className="col-number" />
          <col className="col-number" />
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} className={column.numeric ? "right" : undefined} aria-sort={ariaSort(sort, column.key)}>
                <button type="button" className="sort-button" onClick={() => onSort(column.key)}>
                  {column.label}
                  {sort.key === column.key &&
                    (sort.direction === "asc" ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {majors.map((major) => {
            const color = colorOf(colors, major.faculty);
            const tuition = primaryTuition(major);
            return (
              <tr
                key={major.id}
                style={colorStyle(color)}
                tabIndex={0}
                onClick={() => onOpen(major.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(major.id);
                }}
              >
                <td>
                  <div className="major-title" title={major.name}>
                    {major.name}
                  </div>
                  {major.department && <div className="major-sub">{major.department}</div>}
                </td>
                <td>
                  {major.faculty ? (
                    <span className="faculty-tag">
                      <Marker shape="square" />
                      {major.faculty}
                    </span>
                  ) : (
                    <span className="dash">—</span>
                  )}
                </td>
                <td className="muted">{major.degreeType ?? <span className="dash">—</span>}</td>
                <td className="right">
                  {major.creditHours == null ? (
                    <span className="dash">—</span>
                  ) : (
                    <Measure text={formatCredits(major.creditHours)} value={major.creditHours} max={maxCredits} />
                  )}
                </td>
                <td className="right">
                  {tuition && major.tuitionCurrency ? (
                    <Measure
                      text={formatMoney(tuition.amount, major.tuitionCurrency)}
                      value={tuition.amount}
                      max={maxTuition}
                    />
                  ) : (
                    <span className="dash">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
