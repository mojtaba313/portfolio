import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import {
  VISIT_COOKIE,
  VISIT_COOKIE_MAX_AGE,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
} from "@/features/analytics/lib/constants";
import { parseUserAgent } from "@/features/analytics/lib/parse-ua";
import {
  clipHeader,
  clientIp,
  edgeCountry,
  firstLanguageTag,
  isHttps,
} from "@/features/analytics/lib/request-info";
import {
  adminCookieName,
  getAdminPassword,
  verifySessionValue,
} from "@/features/admin/lib/session";
import { registerPageView, type VisitFacts } from "@/lib/db/visits";

/**
 * Proxy (formerly `middleware` — renamed in Next 16, Node runtime by default).
 *
 * Two jobs, kept in order of importance:
 *
 *  1. Password gate for everything under `/admin`.
 *  2. Page-view logging for the public site. The proxy is the only place that
 *     sees *every* document load — it runs even when the page itself is served
 *     from the static shell, so crawlers, curl, and no-JS clients are recorded
 *     just like real browsers. Client-side navigations never reach here (no
 *     request for a document), so those page views are created by the
 *     `VisitReporter` beacon instead; see features/analytics.
 *
 * Each hit is handed to `registerPageView`, which is what actually groups it:
 * same visitor + under the session gap ⇒ same session. The proxy never decides
 * sessions; it only reports landings.
 *
 * Logging is fire-and-forget: the writes run inside `waitUntil`, after the
 * response is on its way, so a slow database can never slow down a page view,
 * and a failed write loses one page view — never a response.
 */

/** UA and referrer columns are bounded so a hostile client cannot bloat a row. */
const MAX_UA = 512;
const MAX_REFERRER = 500;
const MAX_PATH = 500;

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) return adminGate(request);

  if (!shouldLogDocument(request)) return NextResponse.next();

  // Ids are minted here, not in the database, because the page-view id has to
  // reach the browser in a cookie immediately — the beacon uses it to attach
  // dwell time and hardware specs to this exact view.
  const pageViewId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  // Minted once and used for both the cookie and the database row — if the two
  // ever diverged, every landing would invent a new "visitor".
  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? crypto.randomUUID();
  const isNewVisitor = !request.cookies.get(VISITOR_COOKIE)?.value;

  // Starts now, settles after the response is flushed — see module doc.
  event.waitUntil(
    writePageView(request, { pageViewId, sessionId, visitorId }).catch(() => {
      // Last line of defence: logging must never reject in the proxy.
    }),
  );

  const response = NextResponse.next();
  response.cookies.set(VISIT_COOKIE, pageViewId, {
    path: "/",
    maxAge: VISIT_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: isHttps(request),
  });
  if (isNewVisitor) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
      secure: isHttps(request),
    });
  }
  return response;
}

/**
 * Only real page loads are logged here, decided by `sec-fetch-dest`:
 *
 *  - `document` — a top-level navigation. That is a page view.
 *  - `null` — no Fetch Metadata at all (curl, monitors, legacy clients), which
 *    is exactly the traffic a server-side logger exists to catch.
 *  - anything else — `empty` (client-side navigations and prefetches), `script`,
 *    `image`, … — is not a page view. Soft navigations are logged by the
 *    `VisitReporter` beacon instead, and prefetches must never count.
 *
 * The flight headers (`rsc`, `next-router-prefetch`) would be the obvious
 * signal, but Next 16 strips them before the proxy runs — verified against a
 * header echo: only `sec-fetch-*` survives. Dest alone classifies correctly.
 */
function shouldLogDocument(request: NextRequest): boolean {
  if (request.method !== "GET") return false;
  const dest = request.headers.get("sec-fetch-dest");
  return dest === "document" || dest === null;
}

async function writePageView(
  request: NextRequest,
  ids: { pageViewId: string; sessionId: string; visitorId: string },
): Promise<void> {
  const userAgent = request.headers.get("user-agent");
  const parsed = parseUserAgent(userAgent);
  const facts: VisitFacts = {
    ip: clientIp(request.headers),
    country: edgeCountry(request.headers),
    language: firstLanguageTag(request.headers),
    userAgent: clipHeader(userAgent, MAX_UA),
    browser: parsed.browser,
    os: parsed.os,
    device: parsed.device,
    isBot: parsed.isBot,
    owner: await hasAdminSession(request),
  };

  await registerPageView({
    visitorId: ids.visitorId,
    pageViewId: ids.pageViewId,
    sessionId: ids.sessionId,
    // nextUrl is always well-formed; the slice only bounds a hostile query.
    path: (request.nextUrl.pathname + request.nextUrl.search).slice(
      0,
      MAX_PATH,
    ),
    referrer: clipHeader(request.headers.get("referer"), MAX_REFERRER),
    facts,
  });
}

/**
 * Password gate for the admin area.
 *
 * `/admin/login` is the only public route under `/admin`; everything else
 * needs a valid signed session cookie (see `features/admin/lib/session`).
 * Stateless by design: no session table, nothing to clean up — an expired
 * or forged cookie simply reads as signed-out and bounces to login.
 */
async function adminGate(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  if (await hasAdminSession(request)) return NextResponse.next();

  const login = request.nextUrl.clone();
  login.pathname = "/admin/login";
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

/** Shared by the gate and the `owner` flag on logged visits. */
async function hasAdminSession(request: NextRequest): Promise<boolean> {
  return verifySessionValue(
    request.cookies.get(adminCookieName())?.value,
    getAdminPassword(),
  );
}

export const config = {
  /*
   * Everything except the API (self-calls and the beacon), the Next build
   * internals, and paths with an extension — favicon, robots, sitemap, and
   * every file in /public are assets, not page views. App routes here are
   * extensionless by design (see the project slugs), so the dot rule cannot
   * swallow a real page.
   */
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};
