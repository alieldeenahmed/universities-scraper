export interface HttpRequestOptions {
  headers?: Record<string, string>;
}

/**
 * Fetching pages for adapters. Implementations throw ScrapeError, so adapters
 * and the crawl use case only ever deal with one kind of failure.
 */
export interface HttpClient {
  getText(url: string, options?: HttpRequestOptions): Promise<string>;
  getJson<T = unknown>(url: string, options?: HttpRequestOptions): Promise<T>;
}
