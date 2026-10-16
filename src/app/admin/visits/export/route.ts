import { pageViewsToCsv, sessionsToCsv } from "@/features/admin/lib/visit-csv";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import {
  listPageViewsForExport,
  listSessionsForExport,
  type VisitScope,
} from "@/lib/db/visits";

/**
 * CSV download of the visit analytics, honouring the same filters as the list
 * pages (`?q=`, `?scope=`, `?ip=`) so "what I see is what I export".
 *
 * Two grains, chosen with `?what=`:
 *  - `sessions` (default) — one row per visit, with the whole page trail.
 *  - `pageviews` — one row per page load, with dwell time: the grain to
 *    pivot/analyse when the question is about pages rather than people.
 *
 * Behind the admin gate twice: the proxy requires a session cookie for any
 * `/admin/*` URL, and `requireAdmin` verifies it again here — route handlers
 * are directly invocable, so they never trust the gate alone.
 */
export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.slice(0, 200) || undefined;
  const ip = url.searchParams.get("ip")?.slice(0, 45) || undefined;
  const scopeParam = url.searchParams.get("scope");
  const scope: VisitScope =
    scopeParam === "human" || scopeParam === "bot" ? scopeParam : "all";
  const what = url.searchParams.get("what");

  const filter = { q, ip, scope };
  const stamp = new Date().toISOString().slice(0, 10);

  const csv =
    what === "pageviews"
      ? pageViewsToCsv(await listPageViewsForExport(filter))
      : sessionsToCsv(await listSessionsForExport(filter));

  /*
   * BOM: without it, Excel on Windows reads UTF-8 as the local codepage and
   * any Persian (paths, referrers) turns to mojibake. Notepad, Numbers, and
   * pandas all skip it harmlessly.
   */
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${
        what === "pageviews" ? "pageviews" : "sessions"
      }-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}