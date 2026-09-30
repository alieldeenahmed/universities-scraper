import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/main/config";

describe("loadConfig", () => {
  it("has working defaults for a laptop run", () => {
    const config = loadConfig({});
    expect(config.DATABASE_URL).toBeUndefined();
    expect(config).toMatchObject({
      PORT: 3000,
      SCHEDULER_ENABLED: true,
      SCHEDULER_TICK_SECONDS: 300,
      HTTP_MIN_DELAY_MS: 2000,
    });
  });

  it("treats an empty DATABASE_URL as not set", () => {
    expect(loadConfig({ DATABASE_URL: "   " }).DATABASE_URL).toBeUndefined();
    expect(loadConfig({ DATABASE_URL: "postgres://u:p@host/db" }).DATABASE_URL).toBe("postgres://u:p@host/db");
  });

  it("reads numbers and flags from strings", () => {
    const config = loadConfig({ PORT: "8080", SCHEDULER_ENABLED: "0", HTTP_MIN_DELAY_MS: "500" });
    expect(config).toMatchObject({ PORT: 8080, SCHEDULER_ENABLED: false, HTTP_MIN_DELAY_MS: 500 });
  });

  it("explains what is wrong", () => {
    expect(() => loadConfig({ PORT: "banana" })).toThrow(/invalid configuration: PORT/);
    expect(() => loadConfig({ SCHEDULER_TICK_SECONDS: "1" })).toThrow(/SCHEDULER_TICK_SECONDS/);
  });
});
