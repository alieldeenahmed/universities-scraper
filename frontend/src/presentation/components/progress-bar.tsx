interface ProgressBarProps {
  /** 0-100, or null when the total isn't known yet */
  percent: number | null;
  label: string;
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  return (
    <div>
      <div
        className="progress"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
      >
        <div
          className={`progress-bar${percent == null ? " indeterminate" : ""}`}
          style={percent == null ? undefined : { width: `${percent}%` }}
        />
      </div>
      <div className="progress-label">{label}</div>
    </div>
  );
}
