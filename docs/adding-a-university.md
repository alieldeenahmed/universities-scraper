# Adding a university

A university is one folder with an adapter in it. Nothing else in the app changes.

## 1. Look at the site first

Before writing code, find out where the data actually lives. The order that worked for AUC ([notes](universities/auc.md)):

1. Open the program pages with the network tab open. Is the data in the HTML, in a json request, or in a script tag? An api the site itself uses is the best source and the most stable one.
2. Check `robots.txt` and whether a plain request gets the same page a browser does (`curl -i`). Write down anything that looks like bot protection.
3. Decide per field (faculty, department, description, credit hours, admission requirements, tuition) where it comes from, and what should happen when it isn't there.
4. Write it all in `docs/universities/<slug>.md`.

If the site puts a challenge in front of the data (a WAF challenge, a captcha), report it and look for another source. This tool doesn't try to get past bot protection.

## 2. Write the adapter

Create `backend/src/infrastructure/universities/<slug>/` and implement `UniversityAdapter` (see `domain/ports/university-adapter.ts`):

```ts
interface UniversityAdapter {
  info: UniversityInfo;                    // slug, name, country, website, schedule
  prepare(): Promise<void>;                // shared pages, loaded once per crawl
  discover(): Promise<MajorReference[]>;   // which majors exist right now
  scrape(ref): Promise<ScrapedMajor>;      // one major, throw ScrapeError if it can't
}
```

Things that matter:

- `externalId` has to stay the same from one crawl to the next (a slug of the name works), or every crawl looks like all majors were replaced.
- `version` on the reference is anything that changes when the major changes (a modified timestamp, an etag). Incremental crawls skip majors whose version didn't move. `null` means "always re-scrape".
- Use the `http` you are given (`AdapterDeps`), not `fetch`. It spaces requests per host, retries temporary errors, and reports bot challenges as `blocked`.
- Throw `ScrapeError` with the right kind (`not_found`, `parse`, `transient`, `blocked`). One major failing never stops the others.
- Don't invent data. Return `null` for what you can't find. The crawl turns empty fields into gaps, and the repair loop goes back for them.
- If something is odd but not fatal, add a `warnings` entry (AUC uses it when the credit hours from the text and from the sections disagree).
- Put optional shared sources in `prepare()` behind a try/catch, so one broken page shows up as a gap on those fields instead of failing the whole crawl.

## 3. Register it

Add a line to `ENTRIES` in `backend/src/infrastructure/universities/registry.ts`. On the next start the university appears on the Crawls page and is crawled for the first time by the scheduler.

## 4. Test it against real pages

Follow `tests/universities/auc/`:

- Save trimmed copies of the real responses in `tests/fixtures/<slug>/`. Real markup, not hand written HTML, is the point.
- Test each parser on its own, then the adapter end to end with `FakeHttp` (see `tests/support/auc-http.ts`).
- Add the broken cases: a page that moved, a field that is missing, a shape that changed.
- Then run `npm run crawl -- --university <slug>` once against the live site and look at the gaps it reports.
