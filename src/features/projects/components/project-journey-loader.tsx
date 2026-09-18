"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/*
 * The journey animator loads on its own, behind a dynamic boundary, so GSAP
 * never joins the initial bundle. The section above it is a Server Component,
 * so its markup is already in the static shell; this chunk only layers the
 * scroll choreography on top once it arrives. If it never arrives, the journey
 * stays a readable stack.
 */
const ProjectJourneyAnimator = dynamic(
  () =>
    import("./project-journey-animator").then(
      (module) => module.ProjectJourneyAnimator,
    ),
  { ssr: false },
);

export function ProjectJourneyLoader() {
  /*
   * Two gates before the GSAP chunk downloads, mirroring the scroll-animations
   * loader discipline:
   *
   * 1. Desktop only — the animator's choreography runs behind
   *    `(min-width: 1024px)`, so a phone would pay the download for zero
   *    effect. Checked once via matchMedia; a resize past the breakpoint
   *    after load is rare enough to ignore (the static stack still reads).
   * 2. Near the stage — an IntersectionObserver with a generous rootMargin
   *    starts the download shortly before the journey scrolls into view, so
   *    a visitor who never reaches it never pays either.
   *
   * The initial render is always `null` (identical on server and client) and
   * state flips only from async callbacks, so no hydration mismatch.
   */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    /*
     * Deferred to rAF so state flips only from an async callback, never
     * synchronously in the effect body (same discipline as the scroll
     * loader) — and late enough that the stage markup has mounted.
     */
    let observer: IntersectionObserver | null = null;
    const frame = requestAnimationFrame(() => {
      const stage = document.querySelector("[data-project-stage]");
      if (!stage) return;
      if (typeof IntersectionObserver === "undefined") {
        setReady(true);
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setReady(true);
            observer?.disconnect();
          }
        },
        { rootMargin: "800px 0px" },
      );
      observer.observe(stage);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  if (!ready) return null;
  return <ProjectJourneyAnimator />;
}
