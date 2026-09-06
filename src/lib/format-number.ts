/**
 * Number and relative-time formatting for the Persian UI.
 *
 * The counterpart to features/terminal/lib/format.ts, which pins en-US because
 * the terminal is an English island. Here the locale is fa-IR, so digits render
 * as Persian numerals to match the surrounding text.
 */

const LOCALE = "fa-IR";

/** Formats an integer with Persian digits and separators, e.g. ۱٬۲۳۴. */
export function formatNumber(value: number): string {
  return value.toLocaleString(LOCALE);
}

/**
 * Renders elapsed time as a Persian phrase, e.g. "۱۲ دقیقه پیش".
 *
 * Uses `Intl.RelativeTimeFormat` rather than hand-built strings: Persian plural
 * and unit wording is not something to approximate with string concatenation, and
 * unlike the terminal there is no monospace column width to protect here.
 */
export function formatRelativeTime(from: Date, now: Date = new Date()): string {
  const formatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const seconds = Math.round((from.getTime() - now.getTime()) / 1000);

  const thresholds: [limit: number, divisor: number, unit: Intl.RelativeTimeFormatUnit][] =
    [
      [60, 1, "second"],
      [3600, 60, "minute"],
      [86_400, 3600, "hour"],
      [2_592_000, 86_400, "day"],
      [31_536_000, 2_592_000, "month"],
    ];

  for (const [limit, divisor, unit] of thresholds) {
    if (Math.abs(seconds) < limit) {
      return formatter.format(Math.round(seconds / divisor), unit);
    }
  }

  return formatter.format(Math.round(seconds / 31_536_000), "year");
}
