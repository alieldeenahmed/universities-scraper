import { useEffect, useMemo, useState } from "react";
import { describeStartResult } from "../../application/crawl-controls";
import type { StartedCrawl } from "../../application/ports";
import type { CrawlMode } from "../../domain/crawl";
import { Notice, StateCard } from "../components/notice";
import { GapsTable } from "../crawls/gaps-table";
import { RunsTable } from "../crawls/runs-table";
import { UniversityRow } from "../crawls/university-row";
import { useGateway } from "../gateway-context";
import { useAsync } from "../hooks/use-async";
import { useUniversities } from "../universities-context";

type Message = { kind: "success" | "error"; text: string };

export function CrawlsPage() {
  const gateway = useGateway();
  const universities = useUniversities();

  useEffect(() => {
    document.title = "Crawls";
  }, []);

  const list = universities.universities ?? [];

  // runs and gaps change when a crawl starts or ends, not on every poll
  const changeKey = list
    .map((u) => `${u.id}:${u.activeRun?.id ?? 0}:${u.lastFinishedRun?.id ?? 0}:${u.gaps.open}:${u.gaps.gaveUp}`)
    .join("|");
  const runs = useAsync(() => gateway.listRuns({ limit: 15 }), [gateway, changeKey]);
  const gaps = useAsync(() => gateway.listGaps(), [gateway, changeKey]);

  const [pending, setPending] = useState<Set<number | "all">>(new Set());
  const [message, setMessage] = useState<Message | null>(null);

  const names = useMemo(() => new Map(list.map((u) => [u.id, u.name])), [list]);

  async function run(key: number | "all", start: () => Promise<StartedCrawl[]>) {
    setPending((current) => new Set(current).add(key));
    setMessage(null);
    try {
      const results = await start();
      setMessage({ kind: "success", text: describeStartResult(results, names) });
      universities.reload();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not start the crawl." });
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  const crawlOne = (universityId: number, mode: CrawlMode) =>
    run(universityId, async () => [await gateway.startCrawl(universityId, mode)]);

  const crawlAll = () => run("all", () => gateway.startCrawlAll("full"));

  const now = new Date();
  const anyActive = list.some((u) => u.activeRun);

  return (
    <div className="page stack">
      <div>
        <div className="page-head" style={{ marginBottom: message || universities.error ? 18 : 0 }}>
          <div>
            <h1>Crawls</h1>
            <p>
              Crawls run by themselves on a schedule, catch up after the laptop was off, and retry anything that came
              back incomplete. Use the buttons to run one right now.
            </p>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={crawlAll}
            disabled={pending.has("all") || list.length === 0 || anyActive}
          >
            {pending.has("all") ? "Starting…" : "Crawl all universities"}
          </button>
        </div>

        {message && (
          <Notice kind={message.kind} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        )}
        {universities.error && (
          <Notice kind="error" detail={universities.error.message} onRetry={universities.reload}>
            Could not load the universities.
          </Notice>
        )}
      </div>

      {universities.loading && !universities.universities ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 && !universities.error ? (
        <StateCard title="No universities are set up" />
      ) : (
        <section className="uni-list" aria-label="Universities">
          {list.map((university) => (
            <UniversityRow
              key={university.id}
              university={university}
              now={now}
              requestPending={pending.has(university.id) || pending.has("all")}
              onCrawl={(mode) => void crawlOne(university.id, mode)}
            />
          ))}
        </section>
      )}

      <section>
        <h2 className="section-title">Open gaps</h2>
        {gaps.error ? (
          <Notice kind="error" detail={gaps.error.message} onRetry={gaps.reload}>
            Could not load the gaps.
          </Notice>
        ) : gaps.data && gaps.data.length > 0 ? (
          <GapsTable gaps={gaps.data} universityNames={names} now={now} />
        ) : gaps.data ? (
          <StateCard title="Nothing is missing" tick solid>
            Gaps show up here when a field comes back empty or a major can't be read.
          </StateCard>
        ) : null}
      </section>

      <section>
        <h2 className="section-title">Recent crawls</h2>
        {runs.error ? (
          <Notice kind="error" detail={runs.error.message} onRetry={runs.reload}>
            Could not load the recent crawls.
          </Notice>
        ) : runs.data && runs.data.length > 0 ? (
          <RunsTable runs={runs.data} universityNames={names} now={now} />
        ) : runs.data ? (
          <p className="muted">No crawls yet.</p>
        ) : null}
      </section>
    </div>
  );
}
