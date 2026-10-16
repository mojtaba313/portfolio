"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { VISIT_BEACON_PATH } from "@/features/analytics/lib/constants";
import {
  clearCurrentView,
  currentViewId,
  currentViewStartedAt,
  documentStart,
  markPvConsumed,
  previousView,
  pvConsumed,
  setCurrentView,
} from "@/features/analytics/lib/view-state";

/**
 * The client half of visit analytics.
 *
 * The proxy logs document loads; this component covers what it structurally
 * cannot, and what only a browser knows:
 *
 *  - hardware specs (screen, cores, memory, connection) attached to the page
 *    view the proxy just created;
 *  - client-side navigations, which never reach the server as page requests —
 *    registered server-side through the same `registerPageView`, so they join
 *    the visitor's open session instead of starting a new one;
 *  - dwell time: how long each page was looked at.
 *
 * Dwell is closed in two independent ways, because an unload handler cannot be
 * relied on alone:
 *  1. when the next view opens — the previous page view is closed with the
 *     elapsed time carried in sessionStorage, so a reload, a return visit, or
 *     a soft navigation all record the truth;
 *  2. on `pagehide`, via `sendBeacon`, as a best-effort early close-out for
 *     visitors who never come back.
 *
 * No state, no render output: effect-only, so it adds nothing to the tree and
 * never trips the compiler's sync-setState-in-effect rule. Module scope is
 * load-bearing — it is what makes Strict Mode's double effect a no-op and keeps
 * one page view from reporting twice.
 */

type Specs = ReturnType<typeof collectSpecs>;

/** Beacon response: the ids the server assigned to the page view it created. */
type BeaconResult = {
  pageViewId: string;
  sessionId: string;
  newSession: boolean;
};

/** Last URL this instance acted on; null until the first document load. */
let lastPath: string | null = null;

function readVisitCookie(): string | null {
  const prefix = "pv=";
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      const value = part.slice(prefix.length);
      return value || null;
    }
  }
  return null;
}

/**
 * Everything the browser knows about its own machine. All fields are optional
 * in spirit — older engines lack `deviceMemory` or `connection` — so the
 * schema accepts nulls and the admin shows what exists.
 */
function collectSpecs() {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string };
  };
  return {
    screen: [window.screen.width, window.screen.height] as [number, number],
    viewport: [window.innerWidth, window.innerHeight] as [number, number],
    dpr: window.devicePixelRatio,
    cores: nav.hardwareConcurrency ?? null,
    memoryGb: nav.deviceMemory ?? null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    connection: nav.connection?.effectiveType ?? null,
    touch: (nav.maxTouchPoints ?? 0) > 0,
    colorDepth: window.screen.colorDepth,
    lang: navigator.language,
  };
}

/**
 * One beacon attempt.
 *
 * A single delayed retry on 404 closes the race where hydration beat the
 * proxy's background insert. Network failures are swallowed: a lost specs
 * object degrades one row, it is not worth a loop.
 */
export async function sendBeacon<T>(payload: unknown, retry = false): Promise<T | null> {
  try {
    const response = await fetch(VISIT_BEACON_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (response.status === 404 && retry) {
      window.setTimeout(() => void sendBeacon(payload, false), 1500);
      return null;
    }
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // Best-effort by design; see module doc.
    return null;
  }
}

/**
 * The unload path goes out via `sendBeacon`, not `fetch`.
 *
 * A `fetch(..., { keepalive: true })` started from a `pagehide` handler is
 * routinely cancelled the moment the document is discarded. Beacon requests
 * are the one mechanism the platform guarantees through dismissal, and they
 * are synchronous — the whole requirement.
 *
 * The body is a plain string, not a `Blob` with a JSON content type: a typed
 * beacon is treated as a non-simple request and gets dropped during unload
 * (verified against Chrome — the string form arrives, the Blob form does not).
 */
export function sendOnUnload(payload: unknown) {
  const body = JSON.stringify(payload);
  try {
    const queued = navigator.sendBeacon?.(VISIT_BEACON_PATH, body);
    if (queued) return;
  } catch {
    // Fall through to fetch below.
  }
  void sendBeacon(payload, false);
}

/** Registers the view that replaced the current one. */
function openView(
  path: string,
  specs: Specs,
  previous: { pageViewId: string; dwellMs: number } | null,
) {
  void sendBeacon<BeaconResult>(
    {
      path,
      client: specs,
      closePageViewId: previous?.pageViewId ?? null,
      closeDwellMs: previous?.dwellMs ?? null,
    },
    false,
  ).then((result) => {
    if (result) setCurrentView(result.pageViewId);
  });
}

export function VisitReporter() {
  const pathname = usePathname();

  useEffect(() => {
    const path = window.location.pathname + window.location.search;
    const specs = collectSpecs();
    const previous = previousView();

    if (lastPath === null) {
      // First run in a fresh JS context:
      //
      //  - a `pv` cookie nobody consumed yet means the proxy logged this exact
      //    page view a moment ago — enrich that row;
      //  - the same cookie already consumed means this context started
      //    *after* that landing (a soft entry, e.g. returning from /admin), so
      //    this view has no row yet — open one;
      //  - no cookie at all, with cookies working: likewise no row — open one;
      //  - no cookie and cookies disabled: the proxy's row exists but cannot
      //    be identified, and opening one would duplicate it. Do nothing.
      lastPath = path;
      const pageViewId = readVisitCookie();
      if (pageViewId && !pvConsumed(pageViewId)) {
        markPvConsumed(pageViewId);
        // Close the previous page first; never close the view being enriched.
        const closing =
          previous && previous.pageViewId !== pageViewId ? previous : null;
        if (closing) {
          void sendBeacon({
            pageViewId: closing.pageViewId,
            dwellMs: closing.dwellMs,
          });
        }
        setCurrentView(pageViewId, documentStart());
        void sendBeacon({ pageViewId, client: specs }, true);
        return;
      }
      if (pageViewId || navigator.cookieEnabled) openView(path, specs, previous);
      return;
    }

    if (path === lastPath) return;
    lastPath = path;
    openView(path, specs, {
      pageViewId: currentViewId() ?? previous?.pageViewId ?? "",
      dwellMs: Date.now() - currentViewStartedAt(),
    });
  }, [pathname]);

  // Dwell close-out. `pagehide` fires for tab close, reload and bfcache
  // eviction — everything that ends this page's life.
  useEffect(() => {
    const closeOut = () => {
      const pageViewId = currentViewId();
      if (!pageViewId) return;
      // Clear both the module pointer and the session mirror before sending:
      // pagehide can fire more than once for one document (bfcache restore),
      // and the first close-out is the honest one.
      clearCurrentView();
      sendOnUnload({
        pageViewId,
        dwellMs: Date.now() - currentViewStartedAt(),
      });
    };
    window.addEventListener("pagehide", closeOut);
    return () => window.removeEventListener("pagehide", closeOut);
  }, []);

  return null;
}
