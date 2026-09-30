# Operations

## Health of a university

Shown on the Crawls page, computed from the last finished crawl and the open gaps.

| State | Meaning |
|---|---|
| Not crawled yet | no crawl has finished. The scheduler starts one by itself |
| Healthy | last crawl fine, no open gaps, not overdue |
| Needs a look | one of: last crawl finished with issues, open gaps, gaps we gave up on, no good crawl for twice the schedule |
| Failing | the last crawl failed outright (could not list the majors, blocked, crashed) |

## Gaps and the repair loop

A gap is something we expected and did not get. They are created while crawling:

| Kind | Example |
|---|---|
| Missing field | credit hours / tuition / admission requirements / department came back empty |
| Suspect value | 46 credit hours for a bachelor's degree, a two line description, a warning from the adapter |
| Could not scrape | the major's page failed or had an unexpected shape |
| Fewer majors than before | a run found less than 80% of what the last good run found |
| Could not list majors | discovery or the shared pages failed |

What happens next, without anyone doing anything:

1. The scheduler sees open gaps and queues a **repair** crawl. It only re-reads the majors that have gaps.
2. After a repair the gaps that no longer show up are resolved. The ones that do are counted again.
3. Repair attempts back off: 1 h, 2 h, 4 h ... up to once a day.
4. After 5 sightings a gap becomes **Needs attention** and is no longer retried by the repair loop. A normal crawl still re-reads that major, so if the site gets fixed it resolves by itself.

"Needs attention" usually means one of: the site changed its markup (fix the parser), the program really has no such information (nothing to fix, it stays listed), or the parser is wrong for a program that is shaped differently from the others.

Other safety nets:

- **A failed crawl never removes data.** Majors are only flagged as no longer listed when discovery worked, and not when the list shrank by more than half (that looks like a broken listing, not closed programs).
- **One broken major doesn't stop the crawl.** The rest is scraped, the broken one gets a gap.
- **Blocked means stop.** Three blocked responses in a row end the crawl as failed with stage `blocked`. The scheduler then waits longer and longer before trying that university again. Nothing tries to get around the block.
- **Failures back off.** After a failed crawl the next attempt waits 1 h, 2 h, 4 h ... (a crawl that was only interrupted by the app stopping doesn't count).
- **No double crawls.** The database allows one pending or running crawl per university. Pressing the button twice, or the scheduler and a person at once, gives one crawl.

## Crawl modes

| Mode | What it does |
|---|---|
| Full | re-reads every major (the "Crawl now" button) |
| Incremental | re-reads only majors whose source changed, or that have open gaps ("Check for changes", and what the scheduler runs) |
| Repair | only majors with open gaps (the scheduler runs this) |

## Settings

In `backend/.env` (see `.env.example`):

| Variable | Default | |
|---|---|---|
| `DATABASE_URL` | empty | Postgres / Neon. Empty = embedded database in `DATA_DIR` |
| `DATA_DIR` | `data/pglite` | where the embedded database lives |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | |
| `FRONTEND_DIR` | `../frontend/dist` | built ui served at `/` |
| `SCHEDULER_ENABLED` | `1` | `0` = only manual crawls |
| `SCHEDULER_TICK_SECONDS` | `300` | how often it looks for overdue crawls and gaps |
| `HTTP_MIN_DELAY_MS` | `2000` | minimum gap between two requests to the same host |
| `USER_AGENT` | identifies the tool | sent with every request |
| `LOG_LEVEL` | `info` | `debug` also logs every major that has gaps |

## When something looks wrong

- **Logs:** the terminal, or `backend/logs/server.log` when started by the scheduled task. Every crawl logs a start and a finish line with the counts.
- **A university is Failing with stage `blocked`:** the site started answering with a challenge or 403. Don't hammer it. Look at the site in a browser, raise `HTTP_MIN_DELAY_MS`, and wait, the scheduler backs off on its own.
- **Failing at `discover` / `prepare`:** the source changed or is down. Check the error text on the Crawls page, then the source (for AUC: the catalog widget api, see [AUC notes](universities/auc.md)).
- **Lots of "Missing field" on one field:** a parser stopped matching, usually after a site redesign. Fix the parser, add the changed page to the test fixtures.
- **Start over:** stop the app and delete `backend/data`. The next start recreates and re-crawls everything.
- **Running a crawl from the terminal** (`npm run crawl`) while the app is running doesn't work with the embedded database (only one process can open it). Use the buttons, or stop the app first. With `DATABASE_URL` set it is fine.
