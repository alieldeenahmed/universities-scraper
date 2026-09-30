import { formatCredits, formatMoney } from "../../domain/format";
import {
  primaryTuition,
  type MajorSortKey,
  type MajorSummary,
  type SortDirection,
} from "../../domain/major";

export interface Sort {
  key: MajorSortKey;
  direction: SortDirection;
}

interface Props {
  majors: MajorSummary[];
  sort: Sort;
  onSort: (key: MajorSortKey) => void;
  onOpen: (id: number) => void;
}

const COLUMNS: Array<{ key: MajorSortKey; label: string; numeric?: boolean }> = [
  { key: "name", label: "Major" },
  { key: "faculty", label: "Faculty" },
  { key: "department", label: "Department" },
  { key: "degreeType", label: "Degree" },
  { key: "creditHours", label: "Credits", numeric: true },
  { key: "tuition", label: "Est. tuition", numeric: true },
];

function ariaSort(sort: Sort, key: MajorSortKey): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

export function MajorsTable({ majors, sort, onSort, onOpen }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} className={column.numeric ? "num" : undefined} aria-sort={ariaSort(sort, column.key)}>
                <button type="button" className="table-sort" onClick={() => onSort(column.key)}>
                  {column.label}
                  <span aria-hidden="true">{sort.key === column.key ? (sort.direction === "asc" ? "▲" : "▼") : ""}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {majors.map((major) => {
            const tuition = primaryTuition(major);
            return (
              <tr
                key={major.id}
                className="clickable"
                tabIndex={0}
                onClick={() => onOpen(major.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(major.id);
                }}
              >
                <td>
                  <div className="major-name">{major.name}</div>
                </td>
                <td>{major.faculty ?? <span className="muted">-</span>}</td>
                <td>{major.department ?? <span className="muted">-</span>}</td>
                <td>{major.degreeType ?? <span className="muted">-</span>}</td>
                <td className="num">{formatCredits(major.creditHours)}</td>
                <td className="num">
                  {tuition && major.tuitionCurrency ? (
                    formatMoney(tuition.amount, major.tuitionCurrency)
                  ) : (
                    <span className="muted">-</span>
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
