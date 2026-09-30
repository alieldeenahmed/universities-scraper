import { describeGap, type Gap } from "../../domain/gap";
import { formatRelative } from "../../domain/format";

interface Props {
  gaps: Gap[];
  universityNames: Map<number, string>;
  now: Date;
}

export function GapsTable({ gaps, universityNames, now }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>University</th>
            <th>Major</th>
            <th>Issue</th>
            <th>Details</th>
            <th>Seen</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((gap) => (
            <tr key={gap.id}>
              <td>{universityNames.get(gap.universityId) ?? `#${gap.universityId}`}</td>
              <td>{gap.majorName ?? <span className="muted">whole university</span>}</td>
              <td>{describeGap(gap)}</td>
              <td className="small">{gap.detail}</td>
              <td className="small" title={`first seen ${formatRelative(gap.firstSeenAt, now)}`}>
                {gap.attempts} time{gap.attempts === 1 ? "" : "s"}, last {formatRelative(gap.lastSeenAt, now)}
              </td>
              <td>
                {gap.status === "gave_up" ? (
                  <span className="badge bad">Needs attention</span>
                ) : (
                  <span className="badge info">Retrying</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
