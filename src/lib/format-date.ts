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

/**
 * A duration as a short Persian string: "۴۵ ثانیه", "۳ دقیقه و ۱۲ ثانیه",
 * "۱ ساعت و ۵ دقیقه". Used for session length and dwell time, where "how
 * long" is the question the number is being asked to answer. Seconds are only
 * spelled out below a minute — above it, the larger unit leads.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds.toLocaleString("fa-IR")} ثانیه`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds
      ? `${minutes.toLocaleString("fa-IR")} دقیقه و ${seconds.toLocaleString("fa-IR")} ثانیه`
      : `${minutes.toLocaleString("fa-IR")} دقیقه`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes
    ? `${hours.toLocaleString("fa-IR")} ساعت و ${restMinutes.toLocaleString("fa-IR")} دقیقه`
    : `${hours.toLocaleString("fa-IR")} ساعت`;
}
