import { summarizeRun } from "../../application/crawl-controls";
import { modeLabel, triggerLabel, type CrawlRun } from "../../domain/crawl";
import { formatDateTime, formatDuration, formatRelative } from "../../domain/format";
import { StatusBadge } from "../components/badges";

interface Props {
  runs: CrawlRun[];
  universityNames: Map<number, string>;
  now: Date;
}

export function RunsTable({ runs, universityNames, now }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>University</th>
            <th>Started</th>
            <th>Trigger</th>
            <th>Mode</th>
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
                <td>{universityNames.get(run.universityId) ?? `#${run.universityId}`}</td>
                <td title={formatDateTime(when)}>{formatRelative(when, now)}</td>
                <td>{triggerLabel(run.trigger)}</td>
                <td>{modeLabel(run.mode)}</td>
                <td>
                  <StatusBadge status={run.status} />
                </td>
                <td className="num">{formatDuration(run.startedAt, run.finishedAt) ?? "-"}</td>
                <td className="small">{run.status === "pending" || run.status === "running" ? "-" : summarizeRun(run)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
