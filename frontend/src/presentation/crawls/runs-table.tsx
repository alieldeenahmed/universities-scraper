import { summarizeRun } from "../../application/crawl-controls";
import { isRunActive, modeLabel, triggerLabel, type CrawlRun } from "../../domain/crawl";
import { formatDateTime, formatDuration, formatRelative } from "../../domain/format";
import { StatusBadge } from "../components/badges";

interface Props {
  runs: CrawlRun[];
  universityNames: Map<number, string>;
  now: Date;
}

export function RunsTable({ runs, universityNames, now }: Props) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>University</th>
            <th>Started</th>
            <th>Run type</th>
            <th>Status</th>
            <th>Took</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const when = run.startedAt ?? run.requestedAt;
            return (
              <tr key={run.id}>
                <td style={{ fontWeight: 600 }}>{universityNames.get(run.universityId) ?? `University ${run.universityId}`}</td>
                <td title={formatDateTime(when)}>{formatRelative(when, now)}</td>
                <td className="stacked">
                  <div className="top">{triggerLabel(run.trigger)}</div>
                  <div className="bottom">{modeLabel(run.mode)}</div>
                </td>
                <td>
                  <StatusBadge status={run.status} />
                </td>
                <td className="num">{formatDuration(run.startedAt, run.finishedAt) ?? <span className="dash">-</span>}</td>
                <td className="small">{isRunActive(run) ? <span className="dash">-</span> : summarizeRun(run)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
