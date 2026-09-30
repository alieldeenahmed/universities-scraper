import { crawlButtonState } from "../../application/crawl-controls";
import { modeLabel, progressPercent, triggerLabel, type CrawlMode } from "../../domain/crawl";
import { formatRelative } from "../../domain/format";
import type { University } from "../../domain/university";
import { HealthBadge } from "../components/badges";
import { ProgressBar } from "../components/progress-bar";

interface Props {
  university: University;
  now: Date;
  requestPending: boolean;
  onCrawl: (mode: CrawlMode) => void;
}

export function UniversityCard({ university, now, requestPending, onCrawl }: Props) {
  const { activeRun, lastSuccessfulRun, health, gaps } = university;
  const button = crawlButtonState(university, requestPending);

  return (
    <article className="card" aria-label={university.name}>
      <div className="card-head">
        <div>
          <h2>{university.name}</h2>
          <span className="muted small">{university.country}</span>
        </div>
        <HealthBadge status={health.status} />
      </div>

      {health.reasons.length > 0 && health.status !== "never_crawled" && (
        <ul className="reasons">
          {health.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      <dl>
        <dt>Majors</dt>
        <dd>
          {university.activeMajors}
          {university.missingMajors > 0 && <span className="muted"> ({university.missingMajors} no longer listed)</span>}
        </dd>
        <dt>Last good crawl</dt>
        <dd>{lastSuccessfulRun?.finishedAt ? formatRelative(lastSuccessfulRun.finishedAt, now) : "never"}</dd>
        <dt>Next scheduled</dt>
        <dd>
          {university.nextDueAt && !university.due ? formatRelative(university.nextDueAt, now) : "due now"}
          <span className="muted"> (every {university.scheduleEveryHours} h)</span>
        </dd>
        <dt>Open gaps</dt>
        <dd>
          {gaps.open + gaps.gaveUp === 0 ? (
            "none"
          ) : (
            <>
              {gaps.open} being retried
              {gaps.gaveUp > 0 && <>, {gaps.gaveUp} need attention</>}
            </>
          )}
        </dd>
      </dl>

      {activeRun && (
        <ProgressBar
          percent={progressPercent(activeRun)}
          label={
            activeRun.status === "pending"
              ? "Waiting for the worker..."
              : activeRun.progress.total > 0
                ? `${modeLabel(activeRun.mode)} crawl: ${activeRun.progress.done} of ${activeRun.progress.total} majors (${triggerLabel(activeRun.trigger).toLowerCase()})`
                : `${modeLabel(activeRun.mode)} crawl: loading the source pages...`
          }
        />
      )}

      <div className="card-actions">
        <button type="button" className="btn primary" disabled={button.disabled} onClick={() => onCrawl("full")}>
          {button.label}
        </button>
        <button
          type="button"
          className="btn"
          disabled={button.disabled}
          onClick={() => onCrawl("incremental")}
          title="Only re-reads majors the university changed"
        >
          Check for changes
        </button>
      </div>
    </article>
  );
}
