import { ApiError, type CatalogGateway, type StartedCrawl } from "../application/ports";
import type { CrawlMode, CrawlRun } from "../domain/crawl";
import type { Gap } from "../domain/gap";
import type { MajorDetail, MajorFacets, MajorFilter, MajorSummary } from "../domain/major";
import type { University } from "../domain/university";
import { makeDetail, makeMajor, makeRun, makeUniversity } from "./builders";

/** A gateway that answers from memory and remembers what it was asked. */
export class FakeGateway implements CatalogGateway {
  universities: University[] = [makeUniversity()];
  majors: MajorSummary[] = [makeMajor()];
  details = new Map<number, MajorDetail>([[1, makeDetail()]]);
  runs: CrawlRun[] = [makeRun()];
  gaps: Gap[] = [];
  facets: MajorFacets | null = null;

  failWith: Error | null = null;
  startError: Error | null = null;

  readonly majorQueries: MajorFilter[] = [];
  readonly started: Array<{ universityId: number | "all"; mode: CrawlMode }> = [];

  private check() {
    if (this.failWith) throw this.failWith;
  }

  async listUniversities() {
    this.check();
    return this.universities;
  }

  async listMajors(filter: MajorFilter) {
    this.check();
    this.majorQueries.push(filter);
    const term = filter.search?.toLowerCase();
    return this.majors.filter(
      (m) =>
        (!filter.faculty || m.faculty === filter.faculty) &&
        (!filter.department || m.department === filter.department) &&
        (!filter.degreeType || m.degreeType === filter.degreeType) &&
        (!term || m.name.toLowerCase().includes(term)),
    );
  }

  async getMajor(id: number) {
    this.check();
    const detail = this.details.get(id);
    if (!detail) throw new ApiError(`major ${id} not found`, 404);
    return detail;
  }

  async getFacets() {
    this.check();
    if (this.facets) return this.facets;
    const faculties = new Map<string, Set<string>>();
    for (const m of this.majors) {
      if (!m.faculty) continue;
      const departments = faculties.get(m.faculty) ?? new Set<string>();
      if (m.department) departments.add(m.department);
      faculties.set(m.faculty, departments);
    }
    return {
      // alphabetical, like the real backend: the ui hands out faculty colours in this order
      faculties: [...faculties]
        .map(([name, departments]) => ({ name, departments: [...departments].sort() }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      degreeTypes: [...new Set(this.majors.map((m) => m.degreeType).filter((d): d is string => Boolean(d)))].sort(),
    };
  }

  async startCrawl(universityId: number, mode: CrawlMode): Promise<StartedCrawl> {
    if (this.startError) throw this.startError;
    this.started.push({ universityId, mode });
    return { universityId, created: true, run: makeRun({ id: 99, universityId, mode, status: "pending" }) };
  }

  async startCrawlAll(mode: CrawlMode): Promise<StartedCrawl[]> {
    if (this.startError) throw this.startError;
    this.started.push({ universityId: "all", mode });
    return this.universities.map((u) => ({
      universityId: u.id,
      created: true,
      run: makeRun({ id: 100 + u.id, universityId: u.id, mode, status: "pending" }),
    }));
  }

  async listRuns() {
    this.check();
    return this.runs;
  }

  async listGaps() {
    this.check();
    return this.gaps;
  }
}
