import type { CrawlMode, CrawlRun, CrawlTrigger } from "../domain/crawl";
import type { CrawlRunRepository, UniversityRepository } from "../domain/ports/repositories";
import type { Clock } from "../domain/ports/system";
import type { University } from "../domain/university";
import { NotFoundError } from "./errors";

export interface RequestedCrawl {
  university: University;
  run: CrawlRun;
  /** false when the university already had a pending/running crawl and that one is returned */
  created: boolean;
}

interface Deps {
  universities: UniversityRepository;
  runs: CrawlRunRepository;
  clock: Clock;
}

/** Puts a crawl in the queue. The worker picks it up from there. */
export class RequestCrawl {
  constructor(private readonly deps: Deps) {}

  async forUniversity(
    universityId: number,
    mode: CrawlMode = "full",
    trigger: CrawlTrigger = "manual",
  ): Promise<RequestedCrawl> {
    const university = await this.deps.universities.findById(universityId);
    if (!university) throw new NotFoundError(`university ${universityId}`);
    return this.request(university, mode, trigger);
  }

  async forAll(mode: CrawlMode = "full", trigger: CrawlTrigger = "manual"): Promise<RequestedCrawl[]> {
    const requested: RequestedCrawl[] = [];
    for (const university of await this.deps.universities.list()) {
      requested.push(await this.request(university, mode, trigger));
    }
    return requested;
  }

  private async request(university: University, mode: CrawlMode, trigger: CrawlTrigger): Promise<RequestedCrawl> {
    const { run, created } = await this.deps.runs.request(
      { universityId: university.id, mode, trigger },
      this.deps.clock.now(),
    );
    return { university, run, created };
  }
}
