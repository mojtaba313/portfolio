/**
 * Date formatting for the Persian UI.
 *
 * The mirror image of features/terminal/lib/format.ts: that module pins en-US
 * because the terminal is an English island, this one pins the Persian calendar
 * because the page is not. Both exist so no call site has to remember which
 * locale it is in — it just imports the right helper.
 */

/**
 * Formats a date in the Persian (Jalali) calendar, e.g. "شهریور ۱۴۰۵".
 *
 * `fa-IR` resolves to the Persian calendar and Persian digits by default, which
 * is what the surrounding text wants. Month precision only: portfolio work is
 * dated by period, and a day number implies more precision than "when this was
 * built" actually has.
 */
export function formatJalaliMonth(date: Date): string {
  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
  });
}

/** Machine-readable ISO date for a `<time datetime>` attribute. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Date *and* time in Persian, e.g. "۲۵ شهریور ۱۴۰۵، ۱۸:۳۲" — for the visit
 * log, where the hour of a hit matters and month precision would be useless.
 * `fa-IR` again resolves to the Persian calendar and Persian digits.
 */
export function formatJalaliDateTime(date: Date): string {
  return date.toLocaleString("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

