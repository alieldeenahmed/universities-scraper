import { useEffect, useMemo, useState } from "react";
import { describeStartResult, pollIntervalMs } from "../../application/crawl-controls";
import type { CrawlMode } from "../../domain/crawl";
import { EmptyState, Notice } from "../components/notice";
import { GapsTable } from "../crawls/gaps-table";
import { RunsTable } from "../crawls/runs-table";
import { UniversityCard } from "../crawls/university-card";
import { useGateway } from "../gateway-context";
import { useAsync } from "../hooks/use-async";
import { usePolling } from "../hooks/use-polling";

type Message = { kind: "success" | "error"; text: string };

export function CrawlsPage() {
  const gateway = useGateway();

  useEffect(() => {
    document.title = "Crawls";
  }, []);

  const universities = usePolling(
    () => gateway.listUniversities(),
    (data) => pollIntervalMs(data ?? []),
  );

  // runs and gaps change when a crawl starts or ends, not on every poll
  const changeKey = (universities.data ?? [])
    .map((u) => `${u.id}:${u.activeRun?.id ?? 0}:${u.lastFinishedRun?.id ?? 0}:${u.gaps.open}:${u.gaps.gaveUp}`)
    .join("|");
  const runs = useAsync(() => gateway.listRuns({ limit: 15 }), [gateway, changeKey]);
  const gaps = useAsync(() => gateway.listGaps(), [gateway, changeKey]);

  const [pending, setPending] = useState<Set<number | "all">>(new Set());
  const [message, setMessage] = useState<Message | null>(null);

  const names = useMemo(
    () => new Map((universities.data ?? []).map((u) => [u.id, u.name])),
    [universities.data],
  );

  async function run(key: number | "all", start: () => Promise<Parameters<typeof describeStartResult>[0]>) {
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
  const list = universities.data ?? [];
  const anyActive = list.some((u) => u.activeRun);

  return (
    <div className="page stack">
      <div className="page-head">
        <div>
          <h1>Crawls</h1>
          <p>
            Crawls run by themselves on a schedule, catch up after the laptop was off, and retry anything that came back
            incomplete. Use the buttons to run one right now.
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={crawlAll}
          disabled={pending.has("all") || list.length === 0 || anyActive}
        >
          {pending.has("all") ? "Starting..." : "Crawl all universities"}
        </button>
      </div>

      {message && (
        <Notice kind={message.kind} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      )}
      {universities.error && (
        <Notice kind="error" onRetry={universities.reload}>
          {universities.error.message}
        </Notice>
      )}

      {universities.loading && !universities.data ? (
        <p className="muted">Loading...</p>
      ) : list.length === 0 && !universities.error ? (
        <EmptyState title="No universities are set up" />
      ) : (
        <section className="cards" aria-label="Universities">
          {list.map((university) => (
            <UniversityCard
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
          <Notice kind="error" onRetry={gaps.reload}>
            {gaps.error.message}
          </Notice>
        ) : gaps.data && gaps.data.length > 0 ? (
          <GapsTable gaps={gaps.data} universityNames={names} now={now} />
        ) : (
          <p className="muted">Nothing is missing. Gaps show up here when a field comes back empty or a major can't be read.</p>
        )}
      </section>

      <section>
        <h2 className="section-title">Recent crawls</h2>
        {runs.error ? (
          <Notice kind="error" onRetry={runs.reload}>
            {runs.error.message}
          </Notice>
        ) : runs.data && runs.data.length > 0 ? (
          <RunsTable runs={runs.data} universityNames={names} now={now} />
        ) : (
          <p className="muted">No crawls yet.</p>
        )}
      </section>
    </div>
  );
}
