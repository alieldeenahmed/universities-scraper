import type { z } from "zod";
import { ApiError, type CatalogGateway, type StartedCrawl } from "../../application/ports";
import type { CrawlMode, CrawlRun } from "../../domain/crawl";
import type { Gap } from "../../domain/gap";
import type { MajorDetail, MajorFacets, MajorFilter, MajorSummary } from "../../domain/major";
import type { University } from "../../domain/university";
import {
  crawlRunSchema,
  errorBodySchema,
  facetsSchema,
  gapSchema,
  majorDetailSchema,
  majorSummarySchema,
  startedAllSchema,
  startedCrawlSchema,
  universitySchema,
} from "./schemas";

type FetchFn = typeof fetch;

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export class HttpCatalogGateway implements CatalogGateway {
  constructor(
    private readonly baseUrl = "",
    private readonly fetchFn: FetchFn = (...args) => fetch(...args),
  ) {}

  listUniversities(): Promise<University[]> {
    return this.get("/api/universities", universitySchema.array());
  }

  listMajors(filter: MajorFilter): Promise<MajorSummary[]> {
    return this.get(`/api/majors${query({ ...filter })}`, majorSummarySchema.array());
  }

  getMajor(id: number): Promise<MajorDetail> {
    return this.get(`/api/majors/${id}`, majorDetailSchema);
  }

  getFacets(universityId?: number): Promise<MajorFacets> {
    return this.get(`/api/facets${query({ universityId })}`, facetsSchema);
  }

  async startCrawl(universityId: number, mode: CrawlMode): Promise<StartedCrawl> {
    const result = await this.post(`/api/universities/${universityId}/crawl`, { mode }, startedCrawlSchema);
    return { universityId, created: result.created, run: result.run };
  }

  async startCrawlAll(mode: CrawlMode): Promise<StartedCrawl[]> {
    const result = await this.post("/api/crawls", { mode }, startedAllSchema);
    return result.runs;
  }

  listRuns(options: { universityId?: number; limit?: number } = {}): Promise<CrawlRun[]> {
    return this.get(`/api/crawls${query({ ...options })}`, crawlRunSchema.array());
  }

  listGaps(universityId?: number): Promise<Gap[]> {
    return this.get(`/api/gaps${query({ universityId })}`, gapSchema.array());
  }

  private get<S extends z.ZodType>(path: string, schema: S): Promise<z.output<S>> {
    return this.request(path, { method: "GET" }, schema);
  }

  private post<S extends z.ZodType>(path: string, body: unknown, schema: S): Promise<z.output<S>> {
    return this.request(
      path,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      schema,
    );
  }

  private async request<S extends z.ZodType>(path: string, init: RequestInit, schema: S): Promise<z.output<S>> {
    let response: Response;
    try {
      response = await this.fetchFn(this.baseUrl + path, init);
    } catch {
      throw new ApiError("Could not reach the server. Is it running?");
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsed = errorBodySchema.safeParse(payload);
      throw new ApiError(parsed.success ? parsed.data.error : `The server answered ${response.status}`, response.status);
    }

    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new ApiError(`Unexpected response from ${path}: ${result.error.issues[0]?.message ?? "invalid shape"}`);
    }
    return result.data;
  }
}
