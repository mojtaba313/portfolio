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
   * The initial render is always `null` (identical on server and client) and
   * state flips only from async callbacks — never synchronously in the effect
   * body — so this component can never cause a hydration mismatch itself.
   *
   * This loader renders last in the layout, so this effect — and therefore
   * any GSAP style write — can only run after all page content has hydrated.
   * The rAF gate additionally covers scroll restoration and deep links, which
   * may already be past the top before the listener attaches.
   */
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onFirstScroll = () => {
      cancelAnimationFrame(frame);
      setScrolled(true);
    };
    frame = requestAnimationFrame(() => {
      window.removeEventListener("scroll", onFirstScroll);
      if (window.scrollY > 0) {
        setScrolled(true);
      } else {
        window.addEventListener("scroll", onFirstScroll, {
          passive: true,
          once: true,
        });
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onFirstScroll);
    };
  }, []);

  if (!scrolled) return null;
  return <ScrollAnimations />;
}
