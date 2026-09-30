import type { UniversityAdapter, UniversityRegistry } from "../../src/domain/ports/university-adapter";
import type { MajorReference, ScrapedMajor } from "../../src/domain/scraped-major";
import type { UniversityInfo } from "../../src/domain/university";
import { scrapedMajor, universityInfo } from "./builders";

export interface FakeAdapterSetup {
  info?: UniversityInfo;
  majors?: ScrapedMajor[];
  /** externalId -> error thrown from scrape() */
  scrapeErrors?: Record<string, Error>;
  prepareError?: Error;
  discoverError?: Error;
}

/** A university adapter that serves whatever the test hands it. */
export class FakeAdapter implements UniversityAdapter {
  readonly info: UniversityInfo;
  readonly scraped: string[] = [];
  majors: ScrapedMajor[];
  scrapeErrors: Record<string, Error>;
  prepareError?: Error;
  discoverError?: Error;

  constructor(setup: FakeAdapterSetup = {}) {
    this.info = setup.info ?? universityInfo();
    this.majors = setup.majors ?? [scrapedMajor()];
    this.scrapeErrors = setup.scrapeErrors ?? {};
    this.prepareError = setup.prepareError;
    this.discoverError = setup.discoverError;
  }

  async prepare(): Promise<void> {
    if (this.prepareError) throw this.prepareError;
  }

  async discover(): Promise<MajorReference[]> {
    if (this.discoverError) throw this.discoverError;
    return this.majors.map((m) => ({
      externalId: m.externalId,
      name: m.name,
      sourceUrl: m.sourceUrl,
      version: m.sourceVersion,
    }));
  }

  async scrape(ref: MajorReference): Promise<ScrapedMajor> {
    this.scraped.push(ref.externalId);
    const error = this.scrapeErrors[ref.externalId];
    if (error) throw error;
    const major = this.majors.find((m) => m.externalId === ref.externalId);
    if (!major) throw new Error(`fake adapter has no ${ref.externalId}`);
    return major;
  }
}

export class FakeRegistry implements UniversityRegistry {
  constructor(private readonly adapters: FakeAdapter[]) {}

  list(): UniversityInfo[] {
    return this.adapters.map((a) => a.info);
  }

  createAdapter(slug: string): UniversityAdapter {
    const adapter = this.adapters.find((a) => a.info.slug === slug);
    if (!adapter) throw new Error(`no adapter for ${slug}`);
    return adapter;
  }
}

/** n majors with distinct ids, all complete */
export function majorsNumbered(count: number, version = "v1"): ScrapedMajor[] {
  return Array.from({ length: count }, (_, i) =>
    scrapedMajor({ externalId: `m${i + 1}`, name: `Major ${i + 1}`, sourceVersion: version }),
  );
}
