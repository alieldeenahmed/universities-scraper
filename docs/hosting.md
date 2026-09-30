# Hosting on a laptop

For now the whole thing runs on one team laptop. The backend serves the API and the built frontend from one port, so there is a single address to open.

## Setup (Windows)

1. Install Node 22 or newer.
2. Clone the repo, then from the repo folder:
   ```bash
   npm run setup
   npm run build
   ```
3. Start it once to check: `npm start` and open http://localhost:3000.
4. Make it start with Windows, from a normal PowerShell:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\windows\install-autostart.ps1
   ```
   This registers a scheduled task that runs at logon. It restarts the server if it crashes and writes to `backend/logs/server.log`. Remove it with `uninstall-autostart.ps1`.

## What happens when the laptop is off or asleep

- **Off, then started:** on startup the scheduler checks every university. Anything whose last good crawl is older than its schedule is crawled straight away. A crawl that was cut off when the laptop shut down is marked as interrupted and does not count as a failure.
- **Asleep:** the process doesn't restart, but the scheduler ticks every few minutes (`SCHEDULER_TICK_SECONDS`), so the first tick after waking up catches up on anything that came due.
- **Crawling:** while a crawl runs, Windows is asked not to go to sleep (a small helper process, stopped again when the crawl ends).
- **Not at logon:** a crawl only runs while the app is running. If nobody logs in to that laptop, nothing is crawled. The data in the database stays, and the next start catches up.

People can also press "Crawl now" / "Crawl all universities" on the Crawls page at any time.

## Letting others open it

It listens on all network interfaces. The address to share is printed at startup, for example `http://192.168.1.4:3000`. Windows will ask once to allow Node through the firewall, allow private networks only.

There is **no login**. Anyone who can reach the port can read everything and press the crawl buttons. That is fine for a prototype on a trusted network, don't expose it to the internet as it is. To keep it on the laptop itself, set `HOST=127.0.0.1` in `backend/.env`.

If people outside the network need it, a tunnel with access control (Cloudflare Tunnel + Cloudflare Access for example) is the least work, and adds the login that the app doesn't have.

## Data

- Without `DATABASE_URL` the database is embedded and lives in `backend/data/pglite`. Back it up by copying that folder while the app is stopped.
- With `DATABASE_URL` (Neon, or any Postgres) the data lives there and survives the laptop. Migrations run on start. Use the plain connection string, `postgres://...?sslmode=require`.
- Moving from one to the other means re-crawling, which takes a few minutes per university. There is nothing in the data that can't be scraped again.

## Moving off the laptop later

Nothing in the app depends on the laptop. The backend is one node process plus a Postgres, so any host that can run a long lived node process works (a small VPS, Fly, Railway, Render). Two things to decide then:

- **Login.** Put it behind something first, see above.
- **Crawl location.** Crawls run inside the same process. If a host blocks outgoing requests or is on an IP range a university dislikes, crawls could be moved to a scheduled job that writes into the same database. The crawl use case doesn't know where it runs.

Vercel is fine for the frontend alone (set `VITE_API_BASE_URL` at build time), but not for the backend: functions are short lived and there are no background workers.
