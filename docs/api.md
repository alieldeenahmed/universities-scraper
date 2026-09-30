# API

JSON over HTTP under `/api`. Dates are ISO strings. Errors are `{ "error": "message" }` with 400 (bad input), 404 or 500.

The frontend validates every response with zod (`frontend/src/infrastructure/api/schemas.ts`) and its tests run against responses captured from this backend, so a change here that isn't mirrored there fails a test.

| Method | Path | What |
|---|---|---|
| GET | `/api/health` | `{ ok: true }` |
| GET | `/api/universities` | every university with counts, last runs, gaps, health, next due time |
| GET | `/api/universities/:id` | one of those |
| POST | `/api/universities/:id/crawl` | queue a crawl. Body `{ "mode": "full" \| "incremental" \| "repair" }`, default `full`. `202` with `{ created: true, run }`, or `200` with `created: false` and the crawl that is already active |
| POST | `/api/crawls` | same for every university. `202` with `{ runs: [{ universityId, created, run }] }` |
| GET | `/api/crawls?universityId=&limit=` | recent runs, newest first (limit 1-100, default 20) |
| GET | `/api/crawls/:id` | one run, for polling progress |
| GET | `/api/majors?universityId=&faculty=&department=&degreeType=&search=&status=` | majors as light summaries (description excerpt, tuition totals, no admission text). `status` is `active` (default) or `missing` |
| GET | `/api/majors/:id` | everything for one major, including full description, admission sections and tuition |
| GET | `/api/facets?universityId=` | faculties with their departments, and degree types, for the filters |
| GET | `/api/gaps?universityId=` | open gaps and the ones we gave up on |

## Crawl run

```json
{
  "id": 2,
  "universityId": 1,
  "mode": "incremental",
  "trigger": "manual",
  "status": "running",
  "requestedAt": "...", "startedAt": "...", "finishedAt": null,
  "progress": { "done": 0, "total": 0 },
  "stats": { "discovered": 0, "scraped": 0, "skipped": 0, "failed": 0, "created": 0, "updated": 0, "unchanged": 0, "markedMissing": 0 },
  "failure": null
}
```

- `status`: `pending`, `running`, `completed`, `completed_with_issues`, `failed`, `expired`.
- `trigger`: `manual`, `schedule`, `startup`, `repair`.
- `progress.total` is `0` while the crawl is still loading the shared pages, before it knows how many majors it has to do.
- `failure.stage` says where it stopped: `prepare`, `discover`, `blocked`, `interrupted`, `timeout`...
