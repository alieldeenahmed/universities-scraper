import type { Clock } from "../../src/domain/ports/system";
import type { University } from "../../src/domain/university";
import { PostgresCrawlRunRepository } from "../../src/infrastructure/repositories/crawl-run-repository";
import { PostgresGapRepository } from "../../src/infrastructure/repositories/gap-repository";
import { PostgresMajorRepository } from "../../src/infrastructure/repositories/major-repository";
import { PostgresUniversityRepository } from "../../src/infrastructure/repositories/university-repository";
import { FakeAdapter, FakeRegistry } from "./fake-adapter";
import { SilentLogger } from "./silent-logger";
import { createTestDb } from "./test-db";

export class TestClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  set(to: Date): void {
    this.current = to;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

/** Real repositories on an in-memory postgres, fake adapters, a clock the test controls. */
export async function createHarness(adapters: FakeAdapter[] = [new FakeAdapter()]) {
  const db = await createTestDb();
  const universities = new PostgresUniversityRepository(db);
  const registry = new FakeRegistry(adapters);
  const all: University[] = await universities.sync(registry.list());

  return {
    db,
    universities,
    majors: new PostgresMajorRepository(db),
    runs: new PostgresCrawlRunRepository(db),
    gaps: new PostgresGapRepository(db),
    registry,
    adapters,
    university: all[0]!,
    clock: new TestClock(new Date("2026-09-30T10:00:00Z")),
    logger: new SilentLogger(),
  };
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;
