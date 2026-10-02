import { useCallback, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { clearFilters } from "../../application/filters";
import { formatRelative } from "../../domain/format";
import { sortMajors, type MajorFilter, type MajorSortKey } from "../../domain/major";
import { Marker } from "../components/marker";
import { MajorsSkeleton, Notice, StateCard } from "../components/notice";
import { useGateway } from "../gateway-context";
import { useAsync } from "../hooks/use-async";
import { MajorDetailPanel } from "../majors/major-detail-panel";
import { MajorsFilters } from "../majors/majors-filters";
import { MajorsTable, type Sort } from "../majors/majors-table";
import { facultyColors } from "../theme/faculty-colors";
import { HEALTH_STYLE, toneColor } from "../theme/status-style";
import { useUniversities } from "../universities-context";

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

  const universities = useUniversities();
  const universityId = Number(params.get("u")) || universities.universities?.[0]?.id;
  const university = universities.universities?.find((u) => u.id === universityId);
  // a finished crawl may have changed the data, so it reloads what is on screen
  const dataVersion = university?.lastSuccessfulRun?.id ?? 0;

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
    [gateway, universityId, dataVersion],
  );
  const majors = useAsync(
    () => (universityId ? gateway.listMajors(filter) : Promise.resolve([])),
    [gateway, universityId, dataVersion, filter.faculty, filter.department, filter.degreeType, filter.search],
  );
  const colors = useMemo(() => facultyColors(facets.data), [facets.data]);

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
  const error = universities.error ?? majors.error;
  const refreshed = university?.lastSuccessfulRun?.finishedAt;
  const healthStyle = university ? HEALTH_STYLE[university.health.status] : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Majors</h1>
          <p>
            {university && <strong>{university.name}. </strong>}
            Undergraduate majors with credit hours, admission requirements and tuition.
          </p>
        </div>

        {university && healthStyle && (
          <span className="pill">
            <Marker shape={healthStyle.shape} color={toneColor(healthStyle.tone)} />
            {refreshed ? `Data refreshed ${formatRelative(refreshed, new Date())}` : "Not crawled yet"}
          </span>
        )}
      </div>

      {universities.universities && universities.universities.length > 1 && (
        <select
          className="select mobile-only"
          style={{ marginBottom: 14 }}
          aria-label="University"
          value={universityId ?? ""}
          onChange={(e) => setParams({ u: e.target.value })}
        >
          {universities.universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      )}

      {error && (
        <Notice
          kind="error"
          detail={error.message}
          onRetry={() => {
            universities.reload();
            majors.reload();
          }}
        >
          Could not load majors.
        </Notice>
      )}

      <MajorsFilters
        filter={filter}
        facets={facets.data}
        colors={colors}
        count={universityId && majors.data ? sorted.length : undefined}
        onChange={onFilterChange}
      />

      {majors.loading && !majors.data ? (
        <MajorsSkeleton />
      ) : majors.data && sorted.length > 0 ? (
        <MajorsTable
          majors={sorted}
          colors={colors}
          sort={sort}
          onSort={onSort}
          onOpen={(id) => update({ major: String(id) }, { replace: false })}
        />
      ) : majors.data && !error ? (
        neverCrawled ? (
          <StateCard
            title="Nothing has been crawled yet"
            action={
              <Link to="/crawls" className="btn primary">
                Open Crawls
              </Link>
            }
          >
            Start a crawl from the Crawls page and the majors will show up here.
          </StateCard>
        ) : (
          <StateCard
            title="No majors match these filters"
            action={
              <button type="button" className="btn" onClick={() => onFilterChange(clearFilters(filter))}>
                Clear filters
              </button>
            }
          >
            Try a different search or clear the filters.
          </StateCard>
        )
      ) : null}

      {openId && (
        <MajorDetailPanel
          majorId={openId}
          colors={colors}
          onClose={() => update({ major: undefined }, { replace: false })}
        />
      )}
    </div>
  );
}
