import type { Logger } from "../../src/domain/ports/system";

export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  fields?: Record<string, unknown>;
}

/** Keeps log calls instead of printing them, so tests can look at what was logged. */
export class SilentLogger implements Logger {
  readonly entries: LogEntry[] = [];

  debug(message: string, fields?: Record<string, unknown>) {
    this.entries.push({ level: "debug", message, fields });
  }
  info(message: string, fields?: Record<string, unknown>) {
    this.entries.push({ level: "info", message, fields });
  }
  warn(message: string, fields?: Record<string, unknown>) {
    this.entries.push({ level: "warn", message, fields });
  }
  error(message: string, fields?: Record<string, unknown>) {
    this.entries.push({ level: "error", message, fields });
  }
}
