import { useCallback, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { sortMajors, type MajorFilter, type MajorSortKey } from "../../domain/major";
import { EmptyState, Notice } from "../components/notice";
import { useGateway } from "../gateway-context";
import { useAsync } from "../hooks/use-async";
import { MajorDetailPanel } from "../majors/major-detail-panel";
import { MajorsFilters } from "../majors/majors-filters";
import { MajorsTable, type Sort } from "../majors/majors-table";

const SORT_KEYS: MajorSortKey[] = ["name", "faculty", "department", "degreeType", "creditHours", "tuition"];

function readSort(params: URLSearchParams): Sort {
  const key = params.get("sort") as MajorSortKey | null;
  return {
    key: key && SORT_KEYS.includes(key) ? key : "name",
    direction: params.get("dir") === "desc" ? "desc" : "asc",
  };
}

export function MajorsPage() {
  const gateway = useGateway();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    document.title = "Majors";
  }, []);

  const universities = useAsync(() => gateway.listUniversities(), [gateway]);
  const universityId = Number(params.get("u")) || universities.data?.[0]?.id;
  const university = universities.data?.find((u) => u.id === universityId);

  const filter: MajorFilter = useMemo(
    () => ({
      universityId,
      faculty: params.get("faculty") ?? undefined,
      department: params.get("department") ?? undefined,
      degreeType: params.get("degree") ?? undefined,
      search: params.get("q") ?? undefined,
    }),
    [params, universityId],
  );
  const sort = readSort(params);
  const openId = Number(params.get("major")) || null;

  const facets = useAsync(
    () => (universityId ? gateway.getFacets(universityId) : Promise.resolve(undefined)),
    [gateway, universityId],
  );
  const majors = useAsync(
    () => (universityId ? gateway.listMajors(filter) : Promise.resolve([])),
    [gateway, universityId, filter.faculty, filter.department, filter.degreeType, filter.search],
  );

  const update = useCallback(
    (changes: Record<string, string | undefined>, options: { replace?: boolean } = { replace: true }) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: options.replace },
      );
    },
    [setParams],
  );

  const onFilterChange = useCallback(
    (next: MajorFilter) =>
      update({
        faculty: next.faculty,
        department: next.department,
        degree: next.degreeType,
        q: next.search,
      }),
    [update],
  );

  const onSort = (key: MajorSortKey) =>
    update({
      sort: key === "name" && sort.key !== "name" ? undefined : key,
      dir: sort.key === key && sort.direction === "asc" ? "desc" : undefined,
    });

  const sorted = useMemo(
    () => (majors.data ? sortMajors(majors.data, sort.key, sort.direction) : []),
    [majors.data, sort.key, sort.direction],
  );

  const neverCrawled = university && university.activeMajors === 0 && !university.lastSuccessfulRun;
  const anyError = universities.error ?? majors.error;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Majors</h1>
          <p>Undergraduate majors with credit hours, admission requirements and tuition.</p>
        </div>
        {universities.data && universities.data.length > 1 && (
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label="University"
            value={universityId ?? ""}
            onChange={(e) => setParams({ u: e.target.value })}
          >
            {universities.data.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {anyError && (
        <Notice
          kind="error"
          onRetry={() => {
            universities.reload();
            majors.reload();
          }}
        >
          {anyError.message}
        </Notice>
      )}

      {university && <p className="muted small" style={{ marginTop: 0 }}>{university.name}</p>}

      <MajorsFilters filter={filter} facets={facets.data} onChange={onFilterChange} />

      {majors.loading && !majors.data ? (
        <p className="muted">Loading majors...</p>
      ) : majors.data && sorted.length > 0 ? (
        <>
          <p className="result-count">
            {sorted.length} major{sorted.length === 1 ? "" : "s"}
          </p>
          <MajorsTable
            majors={sorted}
            sort={sort}
            onSort={onSort}
            onOpen={(id) => update({ major: String(id) }, { replace: false })}
          />
        </>
      ) : majors.data && !anyError ? (
        neverCrawled ? (
          <EmptyState title="Nothing has been crawled yet">
            <p>
              Start a crawl from the <Link to="/crawls">Crawls page</Link> and the majors will show up here.
            </p>
          </EmptyState>
        ) : (
          <EmptyState title="No majors match these filters">
            <p>Try a different search or clear the filters.</p>
          </EmptyState>
        )
      ) : null}

      {openId && <MajorDetailPanel majorId={openId} onClose={() => update({ major: undefined }, { replace: false })} />}
    </div>
  );
}
