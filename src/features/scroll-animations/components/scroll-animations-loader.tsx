"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/*
 * GSAP must never join the initial bundle, but `useGSAP` can only be called
 * from inside a component — so the component that calls it loads behind this
 * dynamic boundary instead. The page renders its content normally; this chunk
 * only attaches entrance animations once it arrives. If it never arrives, the
 * page is simply static.
 */
const ScrollAnimations = dynamic(
  () =>
    import("./scroll-animations").then((module) => module.ScrollAnimations),
  { ssr: false },
);

export function ScrollAnimationsLoader() {
  /*
   * The GSAP chunk downloads only after the first scroll. The reveals target
   * below-fold content, so before any scrolling there is nothing to animate —
   * and a visitor who never scrolls never pays the download at all. Every
   * scroll source counts: wheel, keyboard, deep links, and the terminal's
   * section jumps all fire scroll events, including the browser's own
   * restore-on-load. If the page is ever too short to scroll, the reveals are
   * unnecessary by definition.
   *
   * setState happens only inside the event callback (a subscription), never
   * synchronously in the effect body.
   */
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onFirstScroll = () => setScrolled(true);
    window.addEventListener("scroll", onFirstScroll, {
      passive: true,
      once: true,
    });
    return () => window.removeEventListener("scroll", onFirstScroll);
  }, []);

  if (!scrolled) return null;
  return <ScrollAnimations />;
}
