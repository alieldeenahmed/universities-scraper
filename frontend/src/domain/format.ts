export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    // an unknown currency code shouldn't break the page
    return `${Math.round(amount).toLocaleString("en-US")} ${currency}`;
  }
}

export function formatCredits(credits: number | null): string {
  return credits == null ? "-" : `${credits}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 minutes ago", "in 3 hours". `now` is passed in so it can be tested. */
export function formatRelative(date: Date, now: Date): string {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);

  let text: string;
  if (abs < MINUTE) return "just now";
  if (abs < HOUR) text = plural(Math.round(abs / MINUTE), "minute");
  else if (abs < DAY) text = plural(Math.round(abs / HOUR), "hour");
  else text = plural(Math.round(abs / DAY), "day");

  return diff < 0 ? `${text} ago` : `in ${text}`;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2 min 34 s" between two moments, or null when the run hasn't ended */
export function formatDuration(from: Date | null, to: Date | null): string | null {
  if (!from || !to) return null;
  const seconds = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${seconds % 60} s`;
}
