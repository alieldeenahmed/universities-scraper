import { ScrapeError } from "../../src/domain/errors";
import type { HttpClient } from "../../src/domain/ports/http-client";

type Responder = string | object | ((url: string) => string | object) | Error;

/** An HttpClient that answers from a url -> response table and remembers what was asked. */
export class FakeHttp implements HttpClient {
  readonly requests: string[] = [];
  private readonly routes: Array<[string | RegExp, Responder]> = [];

  on(match: string | RegExp, response: Responder): this {
    this.routes.push([match, response]);
    return this;
  }

  /** like on(), but wins over routes that were added before */
  override(match: string | RegExp, response: Responder): this {
    this.routes.unshift([match, response]);
    return this;
  }

  private find(url: string): Responder {
    this.requests.push(url);
    for (const [match, response] of this.routes) {
      const hit = typeof match === "string" ? url === match : match.test(url);
      if (hit) return response;
    }
    throw new ScrapeError("not_found", "no fake route", url);
  }

  private resolve(url: string): string | object {
    const response = this.find(url);
    if (response instanceof Error) throw response;
    return typeof response === "function" ? response(url) : response;
  }

  async getText(url: string): Promise<string> {
    const value = this.resolve(url);
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  async getJson<T = unknown>(url: string): Promise<T> {
    const value = this.resolve(url);
    return (typeof value === "string" ? JSON.parse(value) : value) as T;
  }
}
