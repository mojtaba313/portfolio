/**
 * Number formatting for terminal output.
 *
 * The locale is hardcoded to "en-US" and that is the entire point. The rest of
 * the site runs under fa-IR, where a bare `value.toLocaleString()` renders
 * Persian digits (۱۲۳٬۴۵۶) and `Intl.RelativeTimeFormat` produces Persian
 * words. Both would be correct everywhere else on the page and wrong here — the
 * terminal is an English LTR island, and a stats line reading "۱٫۲۰۰ stars"
 * inside an otherwise English shell session looks like a bug.
 *
 * Rule for anything added later: never call a `toLocale*` method inside the
 * terminal without passing an explicit locale.
 */

const TERMINAL_LOCALE = "en-US";

/** Formats an integer with thousands separators and Latin digits. */
export function formatNumber(value: number): string {
  return value.toLocaleString(TERMINAL_LOCALE);
}

/** Formats a date as an unambiguous ISO-style day, e.g. "2026-09-05". */
export function formatDate(value: Date): string {
  return value.toLocaleDateString(TERMINAL_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Renders an elapsed duration as a compact English "… ago", e.g. "3m ago".
 *
 * Hand-rolled rather than using `Intl.RelativeTimeFormat` because the output
 * needs to stay terse and stable inside a monospace column; the Intl output
 * ("3 minutes ago") is fine in prose and too wide here.
 */
export function formatRelativeTime(from: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
