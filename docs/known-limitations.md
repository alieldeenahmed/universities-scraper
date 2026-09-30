# Known limitations

Things that are imperfect, roughly in the order they would matter.

## Running it

- **No authentication.** Anyone who can reach the port can read the data and press the crawl buttons. Fine for a prototype on a trusted network, see [hosting](hosting.md).
- **It only works while the laptop is on.** Crawls catch up afterwards, but nothing is crawled while it is off. There is also no alert if a university fails, you have to look at the Crawls page.
- **One process, one crawl at a time.** Universities are crawled one after another. With 50 universities a full pass through all of them takes a while (about 2.5 minutes for AUC with the 2 s spacing), the scheduler spreads them out, but a "Crawl all" is sequential.
- **The embedded database can't be shared between processes.** Don't run `npm run crawl` next to a running app unless `DATABASE_URL` is set.

## Scraping

- **AUC's catalog website is behind a bot challenge and we don't go near it.** The data comes from the catalog's public widget api and the main site instead. If AUC closes that api, the catalog part of the adapter needs a different source. The catalog's robots.txt asks for a 120 second crawl delay for its website pages. The widget api is what AUC's own pages call on every visit and isn't covered by the disallow list, and a full crawl makes about 50 requests spaced 2 s apart, but the delay setting is a judgement call. `HTTP_MIN_DELAY_MS` can be raised.
- **Admission requirements are text, not structured criteria.** They are kept as titled blocks (declaration policy, per certificate minimums, deadlines), so there is no "minimum score" field to sort or filter on.
- **Tuition is only the per credit hour undergraduate rate** and credit hours times that rate. Fees, housing, per semester charges and scholarships are not included.
- **The school admission pages are matched to majors by name.** A program renamed on one site but not the other gets no school specific block, and shows up as a warning gap.
- **The declaration section is found by its heading.** 4 of AUC's 36 majors have none in the catalog (that is how the source is), they only get the school and general requirements.
- **A redesign of the source is found through gaps**, not through a live check. There are no canary tests against the real site, the fixtures are snapshots.
- **New catalog year:** every major is read again once (the version includes the catalog id). Major ids come from the program name, so a renamed program looks like a new one and the old one is flagged as no longer listed.

## Data and UI

- **A gap we gave up on can't be dismissed from the UI.** It clears itself if the source starts returning the field, otherwise it stays listed.
- **The majors list has no pagination and no export.** It is fine for a few thousand rows. CSV export is an obvious next thing.
- **Only undergraduate majors.** Minors, graduate programs and dual degrees are filtered out on purpose.
- **Schedules are set in code** (`everyHours` in each adapter), not in the UI.
