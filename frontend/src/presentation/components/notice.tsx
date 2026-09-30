import type { ReactNode } from "react";

interface NoticeProps {
  kind?: "error" | "success" | "info";
  children: ReactNode;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function Notice({ kind = "info", children, onRetry, onDismiss }: NoticeProps) {
  return (
    <div className={`notice ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span>{children}</span>
      <span>
        {onRetry && (
          <button type="button" className="btn small" onClick={onRetry}>
            Try again
          </button>
        )}
        {onDismiss && (
          <button type="button" className="btn small link" onClick={onDismiss} aria-label="Dismiss">
            Dismiss
          </button>
        )}
      </span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
