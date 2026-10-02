import type { ReactNode } from "react";
import { IconCheck } from "./icons";

interface NoticeProps {
  kind?: "error" | "success" | "info";
  children: ReactNode;
  /** a second, smaller line, e.g. the technical reason behind an error */
  detail?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function Notice({ kind = "info", children, detail, onRetry, onDismiss }: NoticeProps) {
  return (
    <div className={`notice ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span>
        {children}
        {detail && <small>{detail}</small>}
      </span>
      {onRetry && (
        <button type="button" className="btn small" onClick={onRetry}>
          Try again
        </button>
      )}
      {onDismiss && (
        <button type="button" className="link-button" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}

interface StateCardProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** a green tick above the title, for "all good" states */
  tick?: boolean;
  /** a solid border instead of a dashed one (dashed means "empty") */
  solid?: boolean;
}

export function StateCard({ title, children, action, tick, solid }: StateCardProps) {
  return (
    <div className={`state-card${solid ? " solid" : ""}`}>
      {tick && (
        <span className="check-circle">
          <IconCheck size={20} />
        </span>
      )}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="actions">{action}</div>}
    </div>
  );
}

/** grey placeholder rows shown while the majors load */
export function MajorsSkeleton() {
  return (
    <div className="skeleton" role="status" aria-label="Loading majors">
      {[0, 1, 2, 3].map((row) => (
        <div className="skeleton-row" key={row}>
          <span className="tick" />
          <span className="lines">
            <span className="line" />
            <span className="line short" />
          </span>
          <span className="value" />
        </div>
      ))}
      <p>Loading majors…</p>
    </div>
  );
}
