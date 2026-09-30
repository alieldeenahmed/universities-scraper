# Architecture

Internal tool that scrapes undergraduate majors from universities and shows them in a small web UI. AUC is the first university, the design has to hold up to around 50.

## Layout

```
backend/    node + typescript, clean architecture
frontend/   react + vite, clean architecture
docs/
```

Backend and frontend share nothing except the HTTP API. The frontend validates every response itself, so a change in the API breaks a test instead of a page.

## Backend layers

```
src/
  domain/          entities, rules, ports (interfaces). No imports from other layers
  application/     use cases. Only knows domain
  infrastructure/  postgres, http client, university adapters, system stuff
  presentation/    fastify routes, scheduler loop
  main/            wires everything together, cli entry points
```

Dependencies point inwards only. A use case asks for a `MajorRepository`; it doesn't know if that is Postgres, PGlite or an array in a test.

## Adding a university

A university is one folder in `infrastructure/universities/<slug>/` that exports an adapter:

```ts
interface UniversityAdapter {
  info: UniversityInfo;
  prepare(): Promise<void>;                 // once per crawl (shared pages, tuition, ...)
  discover(): Promise<MajorReference[]>;    // what majors exist right now
  scrape(ref: MajorReference): Promise<ScrapedMajor>;
}
```

Register it in `universities/registry.ts` and it gets a schedule, a health status, the crawl buttons and its own rows in the UI. Nothing else changes. Adapters only fetch and parse, everything else (retries, isolation, gap detection, storage) lives in the shared crawl use case.

## Crawling

```
discover -> for each major: scrape (retry, isolated) -> validate -> upsert
         -> compare with the previous run -> record gaps -> mark missing majors
```

- One broken major never stops the rest of the run.
- A major whose source `version` (catalog `modified` timestamp for AUC) didn't change is skipped in a normal run. A full crawl ignores that.
- Nothing is deleted. A major that disappears is marked `missing`, and only if discovery itself worked.
- Every run is a row in `crawl_runs` with counts, so health can be read from the database alone.

### Gaps and self-healing

A gap is something we expected and didn't get: a field that came back empty, a major that failed to scrape, a suspicious number (a 46 credit bachelor's degree), or a big drop in how many majors were found. Gaps are rows in `crawl_gaps` with an attempt counter.

The scheduler does two jobs:

1. start crawls for universities that are overdue (also covers laptop was off / asleep)
2. start a repair crawl for universities with open gaps. It only re-scrapes the affected majors, and backs off after a few attempts so a permanently broken page ends up as `needs attention` instead of being hammered.

Healthy, degraded and failing are computed from the last run and the open gaps.

## Crawl requests

The database is the source of truth. The API (manual crawl button) and the scheduler both insert a `pending` run. A worker claims it with one conditional `UPDATE ... WHERE status = 'pending'`. A partial unique index allows only one active run per university, so double clicks and overlapping triggers do nothing.

## Hosting (for now)

Runs on a team laptop: the backend serves the API and the built frontend from one port. Postgres is either Neon (set `DATABASE_URL`) or an embedded PGlite folder when it isn't set. See `docs/hosting.md`.
