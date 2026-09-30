import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import type { CatalogQueries } from "../../application/catalog-queries";
import type { CrawlWorker } from "../../application/crawl-worker";
import { NotFoundError } from "../../application/errors";
import type { RequestCrawl } from "../../application/request-crawl";
import type { Logger } from "../../domain/ports/system";
import { toCrawlRun, toGap, toMajorDetail, toMajorSummary, toUniversityOverview } from "./dto";

export interface ServerDeps {
  queries: CatalogQueries;
  requestCrawl: RequestCrawl;
  worker: CrawlWorker;
  logger: Logger;
  /** folder with the built frontend. Served at / when it exists. */
  staticDir?: string;
}

const id = z.coerce.number().int().positive();

const majorsQuery = z.object({
  universityId: id.optional(),
  faculty: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  degreeType: z.string().min(1).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["active", "missing"]).default("active"),
});

const crawlBody = z
  .object({ mode: z.enum(["full", "incremental", "repair"]).default("full") })
  .default({ mode: "full" });

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const { queries, requestCrawl, worker, logger } = deps;

  await app.register(cors, { origin: true });

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: "invalid request", details: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: (err as Error).message });

    logger.error("request failed", { method: request.method, url: request.url, error: String(err) });
    return reply.code(500).send({ error: "internal error" });
  });

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/universities", async () => (await queries.universities()).map(toUniversityOverview));

  app.get("/api/universities/:id", async (request) => {
    const { id: universityId } = z.object({ id }).parse(request.params);
    return toUniversityOverview(await queries.university(universityId));
  });

  app.post("/api/universities/:id/crawl", async (request, reply) => {
    const { id: universityId } = z.object({ id }).parse(request.params);
    const { mode } = crawlBody.parse(request.body ?? undefined);

    const { run, created } = await requestCrawl.forUniversity(universityId, mode, "manual");
    if (created) worker.kick();
    return reply.code(created ? 202 : 200).send({ created, run: toCrawlRun(run) });
  });

  app.post("/api/crawls", async (request, reply) => {
    const { mode } = crawlBody.parse(request.body ?? undefined);
    const requested = await requestCrawl.forAll(mode, "manual");
    if (requested.some((r) => r.created)) worker.kick();
    return reply.code(202).send({
      runs: requested.map((r) => ({ universityId: r.university.id, created: r.created, run: toCrawlRun(r.run) })),
    });
  });

  app.get("/api/crawls", async (request) => {
    const query = z.object({ universityId: id.optional(), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query);
    return (await queries.runs(query)).map(toCrawlRun);
  });

  app.get("/api/crawls/:id", async (request) => {
    const { id: runId } = z.object({ id }).parse(request.params);
    return toCrawlRun(await queries.run(runId));
  });

  app.get("/api/majors", async (request) => {
    const filter = majorsQuery.parse(request.query);
    return (await queries.majors(filter)).map(toMajorSummary);
  });

  app.get("/api/majors/:id", async (request) => {
    const { id: majorId } = z.object({ id }).parse(request.params);
    return toMajorDetail(await queries.major(majorId));
  });

  app.get("/api/facets", async (request) => {
    const { universityId } = z.object({ universityId: id.optional() }).parse(request.query);
    return queries.facets(universityId);
  });

  app.get("/api/gaps", async (request) => {
    const { universityId } = z.object({ universityId: id.optional() }).parse(request.query);
    return (await queries.gaps(universityId)).map(toGap);
  });

  await serveFrontend(app, deps.staticDir);
  return app;
}

/** When the frontend has been built, serve it from the same port so the team only needs one address. */
async function serveFrontend(app: FastifyInstance, staticDir?: string): Promise<void> {
  const root = staticDir ? resolve(staticDir) : undefined;
  if (!root || !existsSync(resolve(root, "index.html"))) {
    app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "not found" }));
    return;
  }

  await app.register(fastifyStatic, { root, wildcard: false });
  app.setNotFoundHandler((request, reply) => {
    if (request.method !== "GET" || request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "not found" });
    }
    return reply.sendFile("index.html");
  });
}
