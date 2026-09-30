import type { GapObservation } from "../gap";

export interface DiscoveryAssessment {
  gap: GapObservation | null;
  /**
   * Whether it's believable enough to flag majors we didn't see as missing.
   * If half the list vanished overnight it's far more likely the site (or we)
   * broke than that AUC closed half its programs.
   */
  safeToMarkMissing: boolean;
}

const MIN_PREVIOUS_FOR_COMPARISON = 5;
const WARN_BELOW = 0.8;
const UNSAFE_BELOW = 0.5;

export function assessDiscovery(previousCount: number | null, discovered: number): DiscoveryAssessment {
  if (discovered === 0) {
    return {
      gap: { kind: "count_drop", field: null, detail: "discovery returned no majors" },
      safeToMarkMissing: false,
    };
  }

  if (previousCount == null || previousCount < MIN_PREVIOUS_FOR_COMPARISON) {
    return { gap: null, safeToMarkMissing: true };
  }

  const ratio = discovered / previousCount;
  if (ratio >= WARN_BELOW) return { gap: null, safeToMarkMissing: true };

  return {
    gap: {
      kind: "count_drop",
      field: null,
      detail: `found ${discovered} majors, last time it was ${previousCount}`,
    },
    safeToMarkMissing: ratio >= UNSAFE_BELOW,
  };
}
