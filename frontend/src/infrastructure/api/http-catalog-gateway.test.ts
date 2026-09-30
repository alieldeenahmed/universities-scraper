import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../application/ports";
import crawls from "./fixtures/crawls.json";
import facets from "./fixtures/facets.json";
import gaps from "./fixtures/gaps.json";
import majorDetail from "./fixtures/major-detail.json";
import majors from "./fixtures/majors.json";
import universities from "./fixtures/universities.json";
import { HttpCatalogGateway } from "./http-catalog-gateway";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function gatewayFor(respond: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => respond(String(url), init));
  return { gateway: new HttpCatalogGateway("http://api.test", fetchFn as unknown as typeof fetch), fetchFn };
}

// The json files in ./fixtures were captured from the real backend after a live crawl of AUC.
// If the backend changes its responses, these tests are where it shows.
describe("HttpCatalogGateway against real backend responses", () => {
  it("reads the university overview with dates turned into Date objects", async () => {
    const { gateway } = gatewayFor(() => json(universities));
    const [auc] = await gateway.listUniversities();

    expect(auc?.name).toBe("The American University in Cairo");
    expect(auc?.activeMajors).toBe(36);
    expect(auc?.health.status).toBe("healthy");
    expect(auc?.nextDueAt).toBeInstanceOf(Date);
    expect(auc?.lastSuccessfulRun?.finishedAt).toBeInstanceOf(Date);
    expect(auc?.lastSuccessfulRun?.stats.discovered).toBe(36);
  });

  it("reads the majors list", async () => {
    const { gateway } = gatewayFor(() => json(majors));
    const list = await gateway.listMajors({ universityId: 1 });
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ name: "Accounting (B.A.C.)", creditHours: 127 });
    expect(list[0]?.tuitionTotals[0]).toEqual({ label: "Egyptian students", amount: 88900 });
    expect(list[0]?.lastChangedAt).toBeInstanceOf(Date);
  });

  it("reads a single major with its admission sections and tuition", async () => {
    const { gateway } = gatewayFor(() => json(majorDetail));
    const major = await gateway.getMajor(1);
    expect(major.faculty).toBe("School of Sciences and Engineering");
    expect(major.admissionRequirements?.sections.length).toBeGreaterThan(3);
    expect(major.tuition?.rates.map((r) => r.amountPerCreditHour)).toEqual([700, 735]);
    expect(major.firstSeenAt).toBeInstanceOf(Date);
  });

  it("reads runs, gaps and facets", async () => {
    const { gateway } = gatewayFor((url) => {
      if (url.includes("/api/crawls")) return json(crawls);
      if (url.includes("/api/gaps")) return json(gaps);
      return json(facets);
    });
    expect((await gateway.listRuns()).length).toBeGreaterThan(0);
    expect(await gateway.listGaps()).toEqual([]);
    expect((await gateway.getFacets(1)).faculties).toHaveLength(4);
  });
});

describe("HttpCatalogGateway requests", () => {
  it("sends only the filters that are set", async () => {
    const { gateway, fetchFn } = gatewayFor(() => json([]));
    await gateway.listMajors({ universityId: 1, faculty: "School of Business", search: "", department: undefined });
    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://api.test/api/majors?universityId=1&faculty=School+of+Business");
  });

  it("posts the mode when starting a crawl and returns what the server decided", async () => {
    const run = (crawls as unknown[])[0];
    const { gateway, fetchFn } = gatewayFor(() => json({ created: true, run }, 202));

    const started = await gateway.startCrawl(1, "full");
    expect(started).toMatchObject({ universityId: 1, created: true });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("http://api.test/api/universities/1/crawl");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ mode: "full" });
  });

  it("starts every university from crawl all", async () => {
    const run = (crawls as unknown[])[0];
    const { gateway } = gatewayFor(() => json({ runs: [{ universityId: 1, created: false, run }] }, 202));
    expect(await gateway.startCrawlAll("incremental")).toHaveLength(1);
  });
});

describe("HttpCatalogGateway failures", () => {
  it("turns an error body into a message", async () => {
    const { gateway } = gatewayFor(() => json({ error: "major 9 not found" }, 404));
    const err = await gateway.getMajor(9).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ message: "major 9 not found", status: 404 });
  });

  it("copes with an error page that isn't json", async () => {
    const { gateway } = gatewayFor(() => new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(gateway.listUniversities()).rejects.toMatchObject({ message: "The server answered 502", status: 502 });
  });

  it("says so when the server can't be reached", async () => {
    const { gateway } = gatewayFor(() => {
      throw new TypeError("Failed to fetch");
    });
    await expect(gateway.listUniversities()).rejects.toThrow(/Could not reach the server/);
  });

  it("refuses a response that doesn't match the contract", async () => {
    const broken = (universities as any[]).map((u) => ({ ...u, activeMajors: "thirty six" }));
    const { gateway } = gatewayFor(() => json(broken));
    await expect(gateway.listUniversities()).rejects.toThrow(/Unexpected response from \/api\/universities/);
  });

  it("refuses a date that isn't a date", async () => {
    const broken = (majors as any[]).map((m) => ({ ...m, lastSeenAt: "yesterday" }));
    const { gateway } = gatewayFor(() => json(broken));
    await expect(gateway.listMajors({})).rejects.toBeInstanceOf(ApiError);
  });
});
