import { ScrapeError } from "../../domain/errors";
import type { HttpClient, HttpRequestOptions } from "../../domain/ports/http-client";
import type { Logger } from "../../domain/ports/system";

export interface PoliteHttpOptions {
  userAgent: string;
  timeoutMs?: number;
  /** minimum gap between two requests to the same host */
  minDelayMs?: number;
  /** per host override of minDelayMs, keyed by hostname */
  hostDelays?: Record<string, number>;
  /** retries after the first attempt, for transient failures only */
  maxRetries?: number;
  retryBaseMs?: number;
  logger?: Logger;
  // swappable so the tests don't need a network or real waiting
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const MAX_RETRY_AFTER_MS = 60_000;

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class PoliteHttpClient implements HttpClient {
  private readonly timeoutMs: number;
  private readonly minDelayMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly nextSlot = new Map<string, number>();

  constructor(private readonly options: PoliteHttpOptions) {
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.minDelayMs = options.minDelayMs ?? 1_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseMs = options.retryBaseMs ?? 1_500;
    this.fetchFn = options.fetch ?? fetch;
    this.sleep = options.sleep ?? realSleep;
    this.now = options.now ?? Date.now;
  }

  async getText(url: string, options: HttpRequestOptions = {}): Promise<string> {
    const response = await this.request(url, options);
    return response.text();
  }

  async getJson<T = unknown>(url: string, options: HttpRequestOptions = {}): Promise<T> {
    const response = await this.request(url, {
      ...options,
      headers: { accept: "application/json", ...options.headers },
    });
    const body = await response.text();
    try {
      return JSON.parse(body) as T;
    } catch (cause) {
      throw new ScrapeError("parse", "response was not valid JSON", url, { cause });
    }
  }

  private async request(url: string, options: HttpRequestOptions): Promise<Response> {
    let attempt = 0;
    for (;;) {
      await this.waitForSlot(url);
      try {
        return await this.attempt(url, options);
      } catch (err) {
        const retryable = err instanceof ScrapeError && err.retryable;
        if (!retryable || attempt >= this.maxRetries) throw err;

        attempt += 1;
        const wait = err instanceof RetryAfterError ? err.waitMs : this.retryBaseMs * 2 ** (attempt - 1);
        this.options.logger?.warn("request failed, retrying", { url, attempt, waitMs: wait, error: String(err) });
        await this.sleep(wait);
      }
    }
  }

  private async attempt(url: string, options: HttpRequestOptions): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: { "user-agent": this.options.userAgent, ...options.headers },
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: "follow",
      });
    } catch (cause) {
      throw new ScrapeError("transient", `request failed: ${(cause as Error).message}`, url, { cause });
    }

    // A bot challenge is something to report, not something to get around.
    if (isChallenge(response)) {
      throw new ScrapeError("blocked", "the site answered with a bot protection challenge", url);
    }

    if (response.ok) return response;

    const { status } = response;
    if (status === 404 || status === 410) throw new ScrapeError("not_found", `HTTP ${status}`, url);
    if (status === 401 || status === 403) throw new ScrapeError("blocked", `HTTP ${status}`, url);
    if (status === 429) {
      throw new RetryAfterError(`HTTP 429`, url, retryAfterMs(response) ?? this.retryBaseMs * 4);
    }
    if (status === 408 || status >= 500) throw new ScrapeError("transient", `HTTP ${status}`, url);
    throw new ScrapeError("unexpected", `HTTP ${status}`, url);
  }

  /** spaces requests to one host by reserving the next free time slot */
  private async waitForSlot(url: string): Promise<void> {
    const host = new URL(url).hostname;
    const delay = this.options.hostDelays?.[host] ?? this.minDelayMs;
    const now = this.now();
    const slot = Math.max(now, this.nextSlot.get(host) ?? 0);
    this.nextSlot.set(host, slot + delay);
    if (slot > now) await this.sleep(slot - now);
  }
}

class RetryAfterError extends ScrapeError {
  constructor(
    message: string,
    url: string,
    readonly waitMs: number,
  ) {
    super("transient", message, url);
  }
}

function isChallenge(response: Response): boolean {
  if (response.headers.get("x-amzn-waf-action") === "challenge") return true;
  // the AWS challenge is a bodiless 202
  return response.status === 202 && response.headers.get("content-length") === "0";
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_AFTER_MS);
}
