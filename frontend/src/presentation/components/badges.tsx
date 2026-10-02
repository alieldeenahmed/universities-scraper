import { statusLabel, type CrawlStatus } from "../../domain/crawl";
import { healthLabel, type HealthStatus } from "../../domain/university";
import { HEALTH_STYLE, RUN_STYLE, type StatusStyle } from "../theme/status-style";
import { Marker } from "./marker";

const TONE_CLASS: Record<StatusStyle["tone"], string> = {
  good: "good",
  warn: "warn",
  bad: "bad",
  info: "info",
  neutral: "",
};

function StyledBadge({ style, label }: { style: StatusStyle; label: string }) {
  return (
    <span className={`badge ${TONE_CLASS[style.tone]}`}>
      <Marker shape={style.shape} />
      {label}
    </span>
  );
}

export function HealthBadge({ status }: { status: HealthStatus }) {
  return <StyledBadge style={HEALTH_STYLE[status]} label={healthLabel(status)} />;
}

export function StatusBadge({ status }: { status: CrawlStatus }) {
  return <StyledBadge style={RUN_STYLE[status]} label={statusLabel(status)} />;
}

/** a gap is either still being retried or has been given up on and needs a person */
export function GapStateBadge({ giveUp }: { giveUp: boolean }) {
  return giveUp ? (
    <StyledBadge style={{ shape: "square", tone: "bad" }} label="Needs attention" />
  ) : (
    <StyledBadge style={{ shape: "dot", tone: "info" }} label="Retrying" />
  );
}
