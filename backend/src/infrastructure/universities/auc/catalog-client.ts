import { z } from "zod";
import { ScrapeError } from "../../../domain/errors";
import type { HttpClient } from "../../../domain/ports/http-client";
import { CATALOG_API } from "./urls";

const named = z.object({ name: z.string() });

const catalogSchema = z.object({
  id: z.number(),
  name: z.string(),
  published: z.boolean().optional(),
  archived: z.boolean().optional(),
});

const programSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  modified: z.string().nullish(),
  program_types: z.array(named).default([]),
  degree_types: z.array(named).default([]),
  status: z.object({ active: z.boolean().optional() }).optional(),
});

const parentSchema = z.object({
  id: z.number(),
  name: z.string(),
  hierarchy_type: z.string(),
});

const programDetailSchema = programSummarySchema.extend({
  description: z.string().nullish().transform((d) => d ?? ""),
  parents: z.array(parentSchema).default([]),
  cores: z.array(named).default([]),
});

const hierarchySchema = z.object({
  id: z.number(),
  name: z.string(),
  hierarchy_type: z.string(),
  parents: z.array(parentSchema).default([]),
});

export type CatalogProgramSummary = z.infer<typeof programSummarySchema>;
export type CatalogProgram = z.infer<typeof programDetailSchema>;
export type CatalogHierarchy = z.infer<typeof hierarchySchema>;

function parse<T>(schema: z.ZodType<T>, data: unknown, what: string, url: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue ? issue.path.join(".") : "";
    throw new ScrapeError("parse", `${what} has an unexpected shape (${where}: ${issue?.message})`, url);
  }
  return result.data;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

/** Thin typed wrapper around the Acalog widget api that AUC's catalog exposes. */
export class AucCatalogClient {
  constructor(private readonly http: HttpClient) {}

  /** the newest catalog that is published and not archived */
  async currentCatalogId(): Promise<number> {
    const url = `${CATALOG_API}/catalogs/?type=default`;
    const body = await this.http.getJson<{ "catalog-list"?: unknown }>(url);
    const catalogs = parse(z.array(catalogSchema), body["catalog-list"], "catalog list", url);

    const current = catalogs
      .filter((c) => c.published !== false && !c.archived)
      .sort((a, b) => b.id - a.id)[0];
    if (!current) throw new ScrapeError("parse", "no current catalog in the catalog list", url);
    return current.id;
  }

  async listPrograms(catalogId: number): Promise<CatalogProgramSummary[]> {
    const programs: CatalogProgramSummary[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${CATALOG_API}/catalog/${catalogId}/programs/?page-size=${PAGE_SIZE}&page=${page}`;
      const body = await this.http.getJson<{ count?: number; "program-list"?: unknown }>(url);
      const batch = parse(z.array(programSummarySchema), body["program-list"], "program list", url);
      programs.push(...batch);
      if (batch.length === 0 || programs.length >= (body.count ?? 0)) break;
    }
    return programs;
  }

  async getProgram(catalogId: number, programId: number): Promise<CatalogProgram> {
    const url = `${CATALOG_API}/catalog/${catalogId}/program/${programId}/`;
    return parse(programDetailSchema, await this.http.getJson(url), `program ${programId}`, url);
  }

  async getHierarchy(catalogId: number, hierarchyId: number): Promise<CatalogHierarchy> {
    const url = `${CATALOG_API}/catalog/${catalogId}/hierarchy/${hierarchyId}/`;
    return parse(hierarchySchema, await this.http.getJson(url), `hierarchy ${hierarchyId}`, url);
  }

  programUrl(catalogId: number, programId: number): string {
    return `${CATALOG_API}/catalog/${catalogId}/program/${programId}/`;
  }
}
