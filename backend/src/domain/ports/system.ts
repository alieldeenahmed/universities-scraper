export interface Clock {
  now(): Date;
}

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

/** Keeps the machine from going to sleep while a crawl is running. */
export interface SleepBlocker {
  /** returns a function that releases it again */
  acquire(): () => void;
}
