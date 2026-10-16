"use client";

/**
 * Which page view the tab is currently showing, shared by the two analytics
 * client components.
 *
 * Both halves of a page view's story need the same answer: `VisitReporter`
 * sets it (the proxy created the row and named it in the `pv` cookie; soft
 * navigations get a fresh id back from the beacon), and `SectionEngagement`
 * reads it to attribute section time to that exact row.
 *
 * Mirrored into sessionStorage because it must survive a document navigation
 * — a reload, or a trip through /admin — and die with the tab. With storage
 * blocked, the module-scoped value carries the current document alone.
 */

const PV_CONSUMED_KEY = "visit:pv-consumed";
const CURRENT_VIEW_KEY = "visit:current-view";
const VIEW_START_KEY = "visit:view-start";

/** Beyond a day the stored start time is junk, not a reading. */
export const MAX_TRACKED_VIEW_MS = 24 * 60 * 60 * 1000;

let currentPageViewId: string | null = null;
let currentViewStart = Date.now();

export function readSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSessionItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // See module doc.
  }
}

export function clearSessionItem(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // See module doc.
  }
}

export function pvConsumed(pageViewId: string): boolean {
  return readSessionItem(PV_CONSUMED_KEY) === pageViewId;
}

export function markPvConsumed(pageViewId: string): void {
  writeSessionItem(PV_CONSUMED_KEY, pageViewId);
}

/**
 * The page view on screen, falling back to the sessionStorage mirror so a
 * freshly loaded document (whose reporter has not hydrated yet) still knows
 * which row it is looking at.
 */
export function currentViewId(): string | null {
  return currentPageViewId ?? readSessionItem(CURRENT_VIEW_KEY);
}

export function currentViewStartedAt(): number {
  return currentViewStart;
}

/**
 * Marks a page view as on screen.
 *
 * `from` defaults to now, which is right for views the reporter opened itself
 * (soft navigations). The proxy's view for a hard load started at the
 * document's navigation start — recovered from `performance.now()`, which
 * counts from that moment — so the reporter passes that: hydration on a page
 * this heavy takes seconds, and dwell that ignores the time before hydration
 * understates every first view.
 */
export function setCurrentView(pageViewId: string, from?: number) {
  currentPageViewId = pageViewId;
  currentViewStart = from ?? Date.now();
  writeSessionItem(CURRENT_VIEW_KEY, pageViewId);
  writeSessionItem(VIEW_START_KEY, String(currentViewStart));
}

/** Forgets the current view — used once its dwell has been closed out. */
export function clearCurrentView() {
  currentPageViewId = null;
  clearSessionItem(CURRENT_VIEW_KEY);
  clearSessionItem(VIEW_START_KEY);
}

/** The previous page view in this tab and how long it was looked at. */
export function previousView(): { pageViewId: string; dwellMs: number } | null {
  const pageViewId = readSessionItem(CURRENT_VIEW_KEY);
  const startedAt = Number(readSessionItem(VIEW_START_KEY));
  if (!pageViewId || !Number.isFinite(startedAt)) return null;
  const dwellMs = Date.now() - startedAt;
  if (dwellMs <= 0 || dwellMs > MAX_TRACKED_VIEW_MS) return null;
  return { pageViewId, dwellMs };
}

/** Wall-clock of this document's navigation start. */
export function documentStart(): number {
  return Date.now() - performance.now();
}