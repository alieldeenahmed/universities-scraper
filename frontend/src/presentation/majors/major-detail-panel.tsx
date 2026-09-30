import { useEffect, useRef } from "react";
import { formatCredits, formatDateTime, formatMoney } from "../../domain/format";
import { useGateway } from "../gateway-context";
import { Notice } from "../components/notice";
import { useAsync } from "../hooks/use-async";

interface Props {
  majorId: number;
  onClose: () => void;
}

export function MajorDetailPanel({ majorId, onClose }: Props) {
  const gateway = useGateway();
  const { data: major, error, loading, reload } = useAsync(() => gateway.getMajor(majorId), [gateway, majorId]);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={major?.name ?? "Major details"}>
        <div className="drawer-head">
          <div>
            {major && <span className="muted small">{major.degreeType ?? "Degree"}</span>}
            <h2>{major?.name ?? (loading ? "Loading..." : "Major")}</h2>
          </div>
          <button ref={closeButton} type="button" className="btn small" onClick={onClose}>
            Close
          </button>
        </div>

        {error && (
          <Notice kind="error" onRetry={reload}>
            {error.message}
          </Notice>
        )}

        {major && (
          <>
            <dl className="facts">
              <Fact label="Faculty" value={major.faculty} />
              <Fact label="Department" value={major.department} />
              <Fact label="Credit hours" value={major.creditHours == null ? null : formatCredits(major.creditHours)} />
              <Fact
                label={`Est. total tuition${major.tuition?.estimatedTotals[0] ? ` (${major.tuition.estimatedTotals[0].label.toLowerCase()})` : ""}`}
                value={
                  major.tuition?.estimatedTotals[0]
                    ? formatMoney(major.tuition.estimatedTotals[0].amount, major.tuition.currency)
                    : null
                }
              />
            </dl>

            <h3>Description</h3>
            {major.description ? <p className="prose">{major.description}</p> : <p className="muted">No description.</p>}

            <h3>Tuition</h3>
            {major.tuition ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student group</th>
                      <th className="num">Per credit hour</th>
                      <th className="num">Estimated total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {major.tuition.rates.map((rate) => {
                      const total = major.tuition!.estimatedTotals.find((t) => t.label === rate.label);
                      return (
                        <tr key={rate.label}>
                          <td>{rate.label}</td>
                          <td className="num">{formatMoney(rate.amountPerCreditHour, major.tuition!.currency)}</td>
                          <td className="num">
                            {total ? formatMoney(total.amount, major.tuition!.currency) : <span className="muted">-</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No tuition information.</p>
            )}

            <h3>Admission requirements</h3>
            {major.admissionRequirements && major.admissionRequirements.sections.length > 0 ? (
              major.admissionRequirements.sections.map((section, index) => (
                <details key={section.title} className="section" open={index === 0}>
                  <summary>{section.title}</summary>
                  <div className="prose">{section.body}</div>
                </details>
              ))
            ) : (
              <p className="muted">No admission requirements found.</p>
            )}

            <h3>Sources</h3>
            <ul className="source-list">
              {[major.sourceUrl, ...(major.admissionRequirements?.sourceUrls ?? []), major.tuition?.sourceUrl]
                .filter((url): url is string => Boolean(url))
                .filter((url, i, all) => all.indexOf(url) === i)
                .map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      {url}
                    </a>
                  </li>
                ))}
            </ul>
            <p className="muted small">
              First seen {formatDateTime(major.firstSeenAt)}. Last changed {formatDateTime(major.lastChangedAt)}.
            </p>
          </>
        )}
      </aside>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{value ?? <span className="muted">-</span>}</dd>
    </div>
  );
}
