export type ScrapeFailureKind =
  | "blocked" // site answered with a bot challenge / 403
  | "not_found"
  | "transient" // timeouts, 5xx, connection resets
  | "parse" // the page loaded but isn't shaped the way we expect
  | "unexpected";

export class ScrapeError extends Error {
  constructor(
    readonly kind: ScrapeFailureKind,
    message: string,
    readonly url?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ScrapeError";
  }

  /** only things that can clear up by themselves are worth retrying right away */
  get retryable(): boolean {
    return this.kind === "transient";
  }
}

export function describeError(err: unknown): string {
  if (err instanceof ScrapeError) {
    return err.url ? `${err.kind}: ${err.message} (${err.url})` : `${err.kind}: ${err.message}`;
  }
  if (err instanceof Error) return `unexpected: ${err.message}`;
  return `unexpected: ${String(err)}`;
}
