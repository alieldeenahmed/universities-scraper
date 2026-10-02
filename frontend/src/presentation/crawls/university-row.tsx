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

function gapSummary(gaps: University["gaps"]): string {
  const parts: string[] = [];
  if (gaps.open > 0) parts.push(`${gaps.open} being retried`);
  if (gaps.gaveUp > 0) parts.push(`${gaps.gaveUp} ${gaps.gaveUp === 1 ? "needs" : "need"} attention`);
  return parts.length > 0 ? parts.join(", ") : "None";
}

export function UniversityRow({ university, now, requestPending, onCrawl }: Props) {
  const { activeRun, lastSuccessfulRun, health } = university;
  const button = crawlButtonState(university, requestPending);

  const progressLabel = !activeRun
    ? ""
    : activeRun.status === "pending"
      ? "Waiting for the worker…"
      : activeRun.progress.total > 0
        ? `${modeLabel(activeRun.mode)} crawl: ${activeRun.progress.done} of ${activeRun.progress.total} majors (${triggerLabel(activeRun.trigger).toLowerCase()})`
        : `${modeLabel(activeRun.mode)} crawl: loading the source pages…`;

  return (
    <article className="uni-row" aria-label={university.name}>
      <div className="uni-head">
        <div className="uni-title">
          <h2>{university.name}</h2>
          <span className="muted small">{university.country}</span>
          <HealthBadge status={health.status} />
        </div>

        <div className="uni-actions">
          <button type="button" className="btn primary" disabled={button.disabled} onClick={() => onCrawl("full")}>
            {button.label}
          </button>
          <button
            type="button"
            className="btn outline"
            disabled={button.disabled}
            onClick={() => onCrawl("incremental")}
            title="Only re-reads majors the university changed"
          >
            Check for changes
          </button>
        </div>
      </div>

      {health.status !== "never_crawled" && health.reasons.length > 0 && (
        <p className="uni-reasons">{health.reasons.join("; ")}.</p>
      )}

      <div className="uni-stats">
        <div className="uni-stat">
          <div className="value">
            {university.activeMajors}
            {university.missingMajors > 0 && <span className="muted"> ({university.missingMajors} no longer listed)</span>}
          </div>
          <div className="label">Majors</div>
        </div>
        <div className="uni-stat">
          <div className="value">
            {lastSuccessfulRun?.finishedAt ? formatRelative(lastSuccessfulRun.finishedAt, now) : "Never"}
          </div>
          <div className="label">Last good crawl</div>
        </div>
        <div className="uni-stat">
          <div className="value">
            {university.nextDueAt && !university.due ? formatRelative(university.nextDueAt, now) : "Due now"}{" "}
            <span className="muted">(every {university.scheduleEveryHours} h)</span>
          </div>
          <div className="label">Next scheduled</div>
        </div>
        <div className="uni-stat">
          <div className="value">{gapSummary(university.gaps)}</div>
          <div className="label">Open gaps</div>
        </div>
      </div>

      {activeRun && (
        <div className="uni-progress">
          <ProgressBar percent={progressPercent(activeRun)} label={progressLabel} />
        </div>
      )}
    </article>
  );
}
