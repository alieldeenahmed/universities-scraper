import { useEffect, useRef } from "react";
import type { MajorDetail } from "../../domain/major";
import { formatCredits, formatDateTime, formatMoney } from "../../domain/format";
import { IconChevronDown, IconClose } from "../components/icons";
import { Marker } from "../components/marker";
import { Notice } from "../components/notice";
import { useGateway } from "../gateway-context";
import { useAsync } from "../hooks/use-async";
import { colorOf, colorStyle } from "../theme/faculty-colors";

interface Props {
  majorId: number;
  colors: Map<string, string>;
  onClose: () => void;
}

export function MajorDetailPanel({ majorId, colors, onClose }: Props) {
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

  const color = colorOf(colors, major?.faculty ?? null);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside
        className="drawer"
        style={colorStyle(color)}
        role="dialog"
        aria-modal="true"
        aria-label={major?.name ?? "Major details"}
      >
        <div className="drawer-head">
          <div>
            <div className="drawer-degree">{major?.degreeType ?? "Degree"}</div>
            <h2>{major?.name ?? (loading ? "Loading…" : "Major")}</h2>
          </div>
          <button ref={closeButton} type="button" className="btn small" onClick={onClose}>
            <IconClose size={15} />
            Close
          </button>
        </div>

        {error && (
          <Notice kind="error" detail={error.message} onRetry={reload}>
            Could not load this major.
          </Notice>
        )}

        {major && <Details major={major} />}
      </aside>
    </>
  );
}

function Details({ major }: { major: MajorDetail }) {
  const tuition = major.tuition;
  const sources = [major.sourceUrl, ...(major.admissionRequirements?.sourceUrls ?? []), tuition?.sourceUrl]
    .filter((url): url is string => Boolean(url))
    .filter((url, index, all) => all.indexOf(url) === index);

  return (
    <>
      <div className="drawer-affiliation">
        {major.faculty ? (
          <div className="faculty-tag">
            <Marker shape="square" />
            {major.faculty}
          </div>
        ) : (
          <div className="muted">No faculty</div>
        )}
        {major.department && <div className="department">{major.department}</div>}
      </div>

      <div className="stat-strip">
        <div className="stat">
          <div className="value">{formatCredits(major.creditHours)}</div>
          <div className="label">Credit hours</div>
        </div>
        {tuition?.estimatedTotals.map((total) => (
          <div className="stat" key={total.label}>
            <div className="value">{formatMoney(total.amount, tuition.currency)}</div>
            <div className="label">Total tuition, {total.label}</div>
          </div>
        ))}
      </div>

      <h3>Description</h3>
      {major.description ? (
        paragraphs(major.description).map((text, index) => (
          <p key={index} className="prose prose-block">
            {text}
          </p>
        ))
      ) : (
        <p className="muted">No description.</p>
      )}

      <h3>Tuition</h3>
      {tuition ? (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Student group</th>
                <th className="right">Per credit hour</th>
                <th className="right">Estimated total</th>
              </tr>
            </thead>
            <tbody>
              {tuition.rates.map((rate) => {
                const total = tuition.estimatedTotals.find((t) => t.label === rate.label);
                return (
                  <tr key={rate.label}>
                    <td>{rate.label}</td>
                    <td className="right num">{formatMoney(rate.amountPerCreditHour, tuition.currency)}</td>
                    <td className="right num" style={{ fontWeight: 650 }}>
                      {total ? formatMoney(total.amount, tuition.currency) : <span className="dash">—</span>}
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
        <div className="accordion">
          {major.admissionRequirements.sections.map((section, index) => (
            <details key={section.title} open={index === 0}>
              <summary>
                <span>{section.title}</span>
                <IconChevronDown className="chevron" size={18} />
              </summary>
              {paragraphs(section.body).map((text, i) => (
                <p key={i} className="prose prose-block">
                  {text}
                </p>
              ))}
            </details>
          ))}
        </div>
      ) : (
        <p className="muted">No admission requirements found.</p>
      )}

      <h3>Sources</h3>
      <ul className="source-list">
        {sources.map((url) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
          </li>
        ))}
      </ul>
      <p className="fineprint">
        First seen {formatDateTime(major.firstSeenAt)}. Last changed {formatDateTime(major.lastChangedAt)}.
      </p>
    </>
  );
}

/** text from the backend separates paragraphs with a blank line */
function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}
