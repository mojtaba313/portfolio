"use client";

import { useEffect } from "react";

import { sendBeacon, sendOnUnload } from "@/features/analytics/components/visit-reporter";
import { currentViewId } from "@/features/analytics/lib/view-state";
import { SECTION_IDS } from "@/lib/sections";

/**
 * Which part of a long page a visitor is actually looking at, and for how long.
 *
 * The rule that shapes everything here: **viewport geometry decides, never the
 * URL**. Landing on `/#projects` and then scrolling down to the skills graph is
 * time spent on skills — reading the hash would have recorded exactly the
 * opposite, which is the failure mode this component exists to avoid. There is
 * no hash handling anywhere below, by design.
 *
 * Two decisions worth stating, both learned from this specific page:
 *
 *  1. **The active section is found geometrically** — the section containing the
 *     viewport's focus line — rather than through IntersectionObserver. The
 *     project journey is GSAP-pinned; while it is pinned the section is
 *     transformed out of its document flow, and intersection ratios collapse to
 *     zero exactly when the visitor is looking straight at it.
 *  2. **Dwell is credited from real elapsed time**, not from counting timer
 *     ticks. The page is heavy enough that a 1-second interval fires every few
 *     seconds under load; counting ticks under-reports the sections a visitor
 *     lingers on. Time is credited whenever the active section changes, and
 *     flushed on every heartbeat, so a throttled timer costs precision nothing.
 */

/** Section ids to watch: the shared registry plus the full-height hero. */
const TRACKED_IDS: readonly string[] = [
  "top",
  SECTION_IDS.projects,
  SECTION_IDS.skills,
  SECTION_IDS.github,
  SECTION_IDS.contact,
];

/** Below this, a section was brushed past, not read. */
const MIN_SECTION_MS = 1000;
/** How often absolute totals are pushed while the page is open. */
const HEARTBEAT_MS = 15_000;

/**
 * Where in the viewport attention sits. Above the middle: on a long page people
 * read the top of a section first, so the bias keeps time attributed to the
 * section being read rather than the one just scrolled past.
 */
const VIEWPORT_FOCUS = 0.35;

type Tally = { dwellMs: number; views: number };

export function SectionEngagement() {
  useEffect(() => {
    const elements = TRACKED_IDS.map((id) => {
      const element = document.getElementById(id);
      return element ? { id, element } : null;
    }).filter((entry): entry is { id: string; element: HTMLElement } => entry !== null);

    // A page without tracked sections (a project detail, say) opts out.
    if (elements.length === 0) return;

    const tallies = new Map<string, Tally>(
      elements.map(({ id }) => [id, { dwellMs: 0, views: 0 }]),
    );

    let activeId: string | null = null;
    let creditedAt = Date.now();
    /**
     * Last known page view id, remembered because handler order on `pagehide`
     * works against us: VisitReporter registered its listener first and clears
     * the view once its own dwell is sent, so by the time this component's
     * listener runs the id is gone. Reporting to the remembered id is the whole
     * reason section time is not lost on every exit.
     */
    let pageViewId: string | null = null;

    /** The section under the focus line, else the closest one to it. */
    const pickActive = (): string | null => {
      const focus = window.scrollY + window.innerHeight * VIEWPORT_FOCUS;
      let hit: string | null = null;
      let nearest: { id: string; distance: number } | null = null;

      for (const { id, element } of elements) {
        const rect = element.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const bottom = top + rect.height;
        if (focus >= top && focus <= bottom) {
          hit = id;
          break;
        }
        const distance = focus < top ? top - focus : focus - bottom;
        if (!nearest || distance < nearest.distance) {
          nearest = { id, distance };
        }
      }
      // In a gap between sections (padding, footer) the closest one is still
      // what the visitor last looked at; fall back to it rather than dropping
      // the seconds on the floor.
      return hit ?? nearest?.id ?? null;
    };

    /** Adds the time since the last credit to whichever section was active. */
    const credit = (now: number) => {
      const elapsed = now - creditedAt;
      creditedAt = now;
      if (elapsed <= 0 || !activeId) return;
      const tally = tallies.get(activeId);
      if (tally) tally.dwellMs += elapsed;
    };

    const refresh = () => {
      const next = pickActive();
      if (next === activeId) return;
      const now = Date.now();
      credit(now);
      if (!next) return; // nothing on screen to attribute to (impossible in practice)
      if (activeId) {
        const previous = tallies.get(activeId);
        if (previous) previous.views += 1;
      }
      const incoming = tallies.get(next);
      if (incoming && incoming.views === 0) incoming.views = 1;
      activeId = next;
    };

    /** Reports worth sending: brushed-past sections are noise. */
    const collect = () =>
      [...tallies.entries()]
        .filter(([, tally]) => tally.dwellMs >= MIN_SECTION_MS)
        .map(([sectionId, tally]) => ({
          sectionId,
          dwellMs: tally.dwellMs,
          views: Math.max(1, tally.views),
        }));

    const push = (unload: boolean) => {
      pageViewId = currentViewId() ?? pageViewId;
      const sections = collect();
      if (!pageViewId || sections.length === 0) return;
      const payload = {
        pageViewId,
        path: window.location.pathname,
        sections,
      };
      if (unload) sendOnUnload(payload);
      else void sendBeacon(payload);
    };

    const heartbeat = () => {
      // Re-derive before crediting: on a heavy page a scroll event can be
      // delayed or dropped entirely (the rAF callback is starved), and the
      // heartbeat is the safety net that stops those seconds being credited to
      // whichever section happened to be active when they passed.
      refresh();
      credit(Date.now());
      push(false);
    };

    // rAF-throttled scroll: geometry is read once per frame at most, and never
    // during layout-thrashing bursts.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        refresh();
      });
    };

    // A hidden tab is not reading: credit up to the moment it went away.
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
      else credit(Date.now());
    };

    const onPageHide = () => {
      credit(Date.now());
      push(true);
    };

    refresh();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    const timer = window.setInterval(heartbeat, HEARTBEAT_MS);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      if (frame) window.cancelAnimationFrame(frame);
      // Unmounting (a soft navigation replaced this page) still reports.
      credit(Date.now());
      push(false);
    };
  }, []);

  return null;
}