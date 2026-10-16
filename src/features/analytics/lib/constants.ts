/**
 * Cookie contract for visit analytics, shared by the two writers:
 *
 *  - `src/proxy.ts` sets both cookies on every logged document load.
 *  - `VisitReporter` (client) reads `pv` to attach hardware specs to the row
 *    the proxy just created.
 *
 * `pv` is intentionally *not* httpOnly — it exists to be read by our own
 * script, carries no privilege (a value only points at a row that already
 * exists), and expires quickly. `vid` identifies the visitor across visits and
 * is therefore httpOnly.
 */

/** Per-pageview id, set by the proxy on document loads. Minutes, not days. */
export const VISIT_COOKIE = "pv";

/** Anonymous visitor id, minted once and kept for a year. */
export const VISITOR_COOKIE = "vid";

/** Long enough for a slow hydrate to still find it, short enough to be stale-proof. */
export const VISIT_COOKIE_MAX_AGE = 600;

export const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** Beacon endpoint the reporter posts to. */
export const VISIT_BEACON_PATH = "/api/visit";
