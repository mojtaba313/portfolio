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
 * panel and the contact form — plus the hero *exit* below. The skills graph is
 * excluded: its canvas mounts asynchronously behind its own observer, and
 * transform animations on its ancestors would fight that layout. The hero
 * *entrance* is excluded too: it is above the fold, where a GSAP entrance
 * would cost first paint, so Motion (already in the bundle) choreographs it.
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
     * Hero exit: a single scrubbed timeline, not a fade-out. As the hero
     * leaves, its content rises and dissolves while the visual sinks and
     * compresses in depth — the two columns separate at different rates, so
     * the handoff to Projects reads as one continuous scene rather than a cut.
     *
     * The visual gets a scale(0.95) to simulate the 3D environment receding,
     * plus a slight Y translate to sink it. This communicates "entering the
     * portfolio" rather than "an animation is playing".
     *
     * Deliberately not touching the parallax layers inside the visual: those
     * transforms are owned by the pointer loop, and two writers on one
     * property is how jank happens.
     */
    const hero = document.querySelector("[data-hero]");
    const heroContent = document.querySelector("[data-hero-content]");
    const heroVisual = document.querySelector("[data-hero-visual]");
    if (hero && heroContent && heroVisual) {
      gsap
        .timeline({
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom 35%",
            scrub: 0.6,
          },
        })
        .to(heroContent, { y: -70, opacity: 0, ease: "none" }, 0)
        .to(
          heroVisual,
          { y: 50, scale: 0.95, opacity: 0.15, ease: "none" },
          0,
        );
    }

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
