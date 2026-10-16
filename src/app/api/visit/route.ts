import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  clientIp,
  edgeCountry,
  firstLanguageTag,
} from "@/features/analytics/lib/request-info";
import { parseUserAgent } from "@/features/analytics/lib/parse-ua";
import { VISITOR_COOKIE_MAX_AGE } from "@/features/analytics/lib/constants";
import { visitBeaconSchema } from "@/features/analytics/lib/visit-schema";
import {
  adminCookieName,
  getAdminPassword,
  verifySessionValue,
} from "@/features/admin/lib/session";
import {
  enrichPageView,
  registerPageView,
  type VisitFacts,
} from "@/lib/db/visits";

/**
 * Client visit beacon (`POST /api/visit`).
 *
 * Three modes, decided by the payload (see visit-schema.ts):
 *
 *  - `attach` — a hard load the proxy already logged: add the hardware specs
 *    and the dwell time to that exact page view (keyed by the `pv` cookie's id).
 *  - `create` — a client-side navigation, which the proxy never sees as a page
 *    request. Registers the page view server-side; `registerPageView` decides
 *    whether it continues the visitor's open session or opens a new one, so the
 *    grouping stays in one place. Answers with the new page view's id, which
 *    the reporter uses for the next dwell report.
 *  - `dwell` — the visitor is leaving: record how long they stayed.
 *
 * Deliberately unauthenticated for creates: rows carry no secret, paths are
 * validated, and requiring a session would drop exactly the visits the feature
 * exists to record. Updates key on unguessable ids, so they can only touch
 * rows that exist.
 */

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  // No Origin header: same-origin GET-style clients (curl) or old browsers —
  // the payload is harmless either way.
  if (!origin) return true;
  return new URL(origin).host === new URL(request.url).host;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "origin" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const parsed = visitBeaconSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const beacon = parsed.data;
  const jar = await cookies();

  if (beacon.pageViewId && beacon.dwellMs && !beacon.path) {
    // Pure dwell close-out (pagehide). No response body needed.
    const ok = await enrichPageView(beacon.pageViewId, {
      dwellMs: beacon.dwellMs,
    });
    return ok
      ? new Response(null, { status: 204 })
      : Response.json({ error: "unknown-view" }, { status: 404 });
  }

  if (beacon.pageViewId) {
    // The previous page view in this tab gets its dwell closed on the way out
    // (reloads and returns), then this one is enriched with the specs.
    if (beacon.closePageViewId && beacon.closeDwellMs) {
      await enrichPageView(beacon.closePageViewId, {
        dwellMs: beacon.closeDwellMs,
      });
    }
    const ok = await enrichPageView(beacon.pageViewId, {
      dwellMs: beacon.dwellMs,
      client: beacon.client,
    });
    // Not found: stale cookie, or the proxy's background insert has not landed
    // yet — the reporter retries once on 404. A second miss is terminal.
    return ok
      ? new Response(null, { status: 204 })
      : Response.json({ error: "unknown-view" }, { status: 404 });
  }

  // Soft navigation: headers of this request describe the visitor exactly as a
  // document request would have.
  const userAgent = request.headers.get("user-agent");
  const parsedUa = parseUserAgent(userAgent);
  // A visitor id may be missing when cookies are blocked or the visitor only
  // ever soft-navigated (no proxy hit to mint one). Mint it here and hand it
  // back in a cookie, otherwise every navigation would look like a brand new
  // person and sessions could never group.
  const existingVisitorId = jar.get("vid")?.value;
  const visitorId = existingVisitorId ?? crypto.randomUUID();

  const facts: VisitFacts = {
    ip: clientIp(request.headers),
    country: edgeCountry(request.headers),
    language: firstLanguageTag(request.headers),
    userAgent: userAgent?.slice(0, 512) ?? null,
    browser: parsedUa.browser,
    os: parsedUa.os,
    device: parsedUa.device,
    isBot: parsedUa.isBot,
    owner: await verifySessionValue(
      jar.get(adminCookieName())?.value,
      getAdminPassword(),
    ),
    client: beacon.client,
  };

  const result = await registerPageView({
    visitorId,
    pageViewId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    path: beacon.path!,
    // Referer on a soft-nav beacon points at the page being left *after* the
    // URL already changed — useless. External attribution arrived with the
    // hard load, which is the session's own entry row.
    referrer: null,
    facts,
    closePageViewId: beacon.closePageViewId,
    closeDwellMs: beacon.closeDwellMs,
  });

  const response = NextResponse.json(
    {
      pageViewId: result.pageViewId,
      sessionId: result.sessionId,
      newSession: result.newSession,
    },
    { status: 200 },
  );
  if (!existingVisitorId) {
    response.cookies.set("vid", visitorId, {
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
    });
  }
  return response;
}