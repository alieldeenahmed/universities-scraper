import { describe, expect, it, vi } from "vitest";
import { ScrapeError } from "../../src/domain/errors";
import { PoliteHttpClient } from "../../src/infrastructure/http/polite-http-client";

function setup(responses: Array<Response | Error>, options: { minDelayMs?: number } = {}) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const sleeps: number[] = [];
  let clock = 1_000_000;
  const queue = [...responses];

  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    const next = queue.shift();
    if (!next) throw new Error("no more fake responses");
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;

  const client = new PoliteHttpClient({
    userAgent: "test-agent/1.0",
    minDelayMs: options.minDelayMs ?? 0,
    retryBaseMs: 100,
    maxRetries: 2,
    fetch: fetchFn,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
  });
  return { client, calls, sleeps };
}

const ok = (body: string, init: ResponseInit = {}) => new Response(body, { status: 200, ...init });

describe("PoliteHttpClient", () => {
  it("sends the configured user agent", async () => {
    const { client, calls } = setup([ok("hello")]);
    expect(await client.getText("https://a.example/x")).toBe("hello");
    expect(calls[0]?.headers["user-agent"]).toBe("test-agent/1.0");
  });

  it("parses json and complains about anything else", async () => {
    const good = setup([ok('{"a":1}')]);
    expect(await good.client.getJson("https://a.example/x")).toEqual({ a: 1 });

    const bad = setup([ok("<html>nope</html>")]);
    await expect(bad.client.getJson("https://a.example/x")).rejects.toMatchObject({ kind: "parse" });
  });

  it("maps status codes to failure kinds", async () => {
    const cases: Array<[number, string]> = [
      [404, "not_found"],
      [403, "blocked"],
      [418, "unexpected"],
    ];
    for (const [status, kind] of cases) {
      const { client } = setup([new Response("", { status })]);
      await expect(client.getText("https://a.example/x")).rejects.toMatchObject({ kind });
    }
  });

  it("reports a bot challenge as blocked and does not retry it", async () => {
    const challenge = new Response(null, { status: 202, headers: { "x-amzn-waf-action": "challenge" } });
    const { client, calls } = setup([challenge]);
    await expect(client.getText("https://a.example/x")).rejects.toMatchObject({ kind: "blocked" });
    expect(calls).toHaveLength(1);
  });

  it("retries server errors with growing waits, then succeeds", async () => {
    const { client, calls, sleeps } = setup([
      new Response("", { status: 503 }),
      new Response("", { status: 502 }),
      ok("finally"),
    ]);
    expect(await client.getText("https://a.example/x")).toBe("finally");
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([100, 200]);
  });

  it("gives up after the retry budget", async () => {
    const { client, calls } = setup([
      new Response("", { status: 500 }),
      new Response("", { status: 500 }),
      new Response("", { status: 500 }),
    ]);
    const err = await client.getText("https://a.example/x").catch((e) => e);
    expect(err).toBeInstanceOf(ScrapeError);
    expect(err.kind).toBe("transient");
    expect(calls).toHaveLength(3);
  });

  it("retries network errors", async () => {
    const { client } = setup([new TypeError("fetch failed"), ok("back")]);
    expect(await client.getText("https://a.example/x")).toBe("back");
  });

  it("honours Retry-After on 429", async () => {
    const { client, sleeps } = setup([
      new Response("", { status: 429, headers: { "retry-after": "3" } }),
      ok("fine"),
    ]);
    await client.getText("https://a.example/x");
    expect(sleeps).toEqual([3000]);
  });

  it("does not retry a 404", async () => {
    const { client, calls } = setup([new Response("", { status: 404 }), ok("never reached")]);
    await expect(client.getText("https://a.example/x")).rejects.toMatchObject({ kind: "not_found" });
    expect(calls).toHaveLength(1);
  });

  it("spaces out requests to the same host but not to different hosts", async () => {
    const { client, sleeps } = setup([ok("1"), ok("2"), ok("3")], { minDelayMs: 500 });
    await client.getText("https://a.example/1");
    await client.getText("https://a.example/2");
    await client.getText("https://b.example/3");
    expect(sleeps).toEqual([500]);
  });
});
