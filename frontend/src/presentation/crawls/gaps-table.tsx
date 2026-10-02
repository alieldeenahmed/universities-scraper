import { describeGap, type Gap } from "../../domain/gap";
import { formatRelative } from "../../domain/format";
import { GapStateBadge } from "../components/badges";

interface Props {
  gaps: Gap[];
  universityNames: Map<number, string>;
  now: Date;
}

export function GapsTable({ gaps, universityNames, now }: Props) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>Major</th>
            <th>Issue</th>
            <th>Seen</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((gap) => (
            <tr key={gap.id}>
              <td className="stacked">
                <div className="top">{gap.majorName ?? "Whole university"}</div>
                <div className="bottom">{universityNames.get(gap.universityId) ?? `University ${gap.universityId}`}</div>
              </td>
              <td>
                <div className="issue">{describeGap(gap)}</div>
                <div className="issue-detail">{gap.detail}</div>
              </td>
              <td className="small" title={`first seen ${formatRelative(gap.firstSeenAt, now)}`}>
                {gap.attempts} time{gap.attempts === 1 ? "" : "s"}, last {formatRelative(gap.lastSeenAt, now)}
              </td>
              <td>
                <GapStateBadge giveUp={gap.status === "gave_up"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
