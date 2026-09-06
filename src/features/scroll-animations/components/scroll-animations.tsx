"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven entrance animations for below-fold content.
 *
 * Any element with `data-reveal` fades up as it enters the viewport. `gsap.from`
 * rather than `gsap.to` is load-bearing, not stylistic: before the animation
 * runs, and if this chunk never loads at all, the element sits at its natural
 * fully-visible state. Content can never be stuck invisible because JavaScript
 * failed — the worst case is a page with no entrance animations.
 *
 * Scope is deliberately narrow: section headers, project cards, the GitHub
 * panel and the contact form. The skills graph is excluded — its canvas mounts
 * asynchronously behind its own observer, and transform animations on its
 * ancestors would fight that layout. The hero is excluded too: it is above the
 * fold, where a GSAP entrance would cost first paint, so it gets a CSS-only
 * animation instead (see .hero-rise in globals.css).
 */
export function ScrollAnimations() {
  useGSAP(() => {
    // The CSS safety net cannot help here — these transforms are set from JS,
    // so the preference has to be checked in JS too. When set, everything stays
    // at its natural state: visible, unmoved.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
      gsap.from(element, {
        y: 28,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: element, start: "top 88%", once: true },
      });
    });

    /*
     * Trigger positions are measured at setup, but layout shifts afterwards:
     * the skills canvas mounts when scrolled toward, and fonts swap in late.
     * Refreshing on load plus one delayed pass keeps triggers honest without
     * observing every resize.
     */
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    const delayed = window.setTimeout(refresh, 2500);
    return () => {
      window.removeEventListener("load", refresh);
      window.clearTimeout(delayed);
    };
  });

  // Renders nothing: the targets already exist in the server HTML and are found
  // by attribute. Returning null keeps this a pure enhancement layer.
  return null;
}
