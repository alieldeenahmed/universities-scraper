# Universities scraper

Internal tool for a startup idea. It scrapes the undergraduate majors of universities (faculty, department, description, credit hours, admission requirements, tuition) and shows them in a small web app. It is not public. AUC is the first university, the structure is meant to take around 50.

It crawls by itself on a schedule, notices what came back incomplete and goes back for it, and has a button for when someone needs fresh data right now.

## Running it

Needs Node 22 or newer.

```bash
npm run setup     # installs backend and frontend
npm run build     # builds the frontend
npm start         # backend + ui on http://localhost:3000
```

The first start creates an embedded database in `backend/data` and does a first crawl of every university by itself. To use Postgres (Neon for example) copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`.

For development, run `npm run dev:backend` and `npm run dev:frontend` in two terminals. The frontend is on http://localhost:5173 and forwards `/api` to the backend.

```bash
npm test                              # everything
npm run crawl -- --university auc     # one crawl from the terminal (--mode full|incremental|repair)
```

Setting it up on a laptop so it starts with Windows is in [docs/hosting.md](docs/hosting.md).

## Layout

```
backend/    node + typescript, clean architecture (domain / application / infrastructure / presentation)
frontend/   react + vite, same layers
docs/       architecture, hosting, how to add a university, api, operations
scripts/    windows auto start
```

## Docs

- [Architecture](docs/architecture.md) - layers, how a crawl works, gaps and self healing
- [AUC notes](docs/universities/auc.md) - where the data lives, what is protected, how each field is found
- [Adding a university](docs/adding-a-university.md)
- [Hosting on a laptop](docs/hosting.md)
- [API](docs/api.md)
- [Operations](docs/operations.md) - health states, gaps, logs, what to do when something breaks
- [Known limitations](docs/known-limitations.md)
