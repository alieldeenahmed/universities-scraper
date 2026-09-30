import type { Logger } from "../../domain/ports/system";

export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function formatFields(fields?: Record<string, unknown>): string {
  if (!fields) return "";
  const parts = Object.entries(fields).map(([key, value]) => {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return `${key}=${text.includes(" ") ? JSON.stringify(text) : text}`;
  });
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

/** One line per event, easy to read in a terminal and easy to grep. */
export class ConsoleLogger implements Logger {
  constructor(private readonly level: LogLevel = "info") {}

  debug(message: string, fields?: Record<string, unknown>) {
    this.write("debug", message, fields);
  }
  info(message: string, fields?: Record<string, unknown>) {
    this.write("info", message, fields);
  }
  warn(message: string, fields?: Record<string, unknown>) {
    this.write("warn", message, fields);
  }
  error(message: string, fields?: Record<string, unknown>) {
    this.write("error", message, fields);
  }

  private write(level: LogLevel, message: string, fields?: Record<string, unknown>) {
    if (ORDER[level] < ORDER[this.level]) return;
    const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}${formatFields(fields)}`;
    (level === "error" || level === "warn" ? console.error : console.log)(line);
  }
}
