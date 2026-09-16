"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven entrance animations for below-fold content.
 *
 * Three conventions, all trigger-based (no pinning, no scrubbing — safe on
 * touch devices) and all `gsap.from`:
 *
 * - `data-reveal` — the element itself fades up on entry.
 * - `data-reveal-group` + `data-reveal-item` children — children rise in a
 *   stagger cascade when the group enters (chip rows, feature lists).
 * - `data-reveal-zoom` — media frames settle from a slight scale-down
 *   while fading in, so imagery lands with weight instead of popping.
 *
 * `gsap.from` rather than `gsap.to` is load-bearing, not stylistic: before
 * the animation runs, and if this chunk never loads at all, the element
 * sits at its natural fully-visible state. Content can never be stuck
 * invisible because JavaScript failed — the worst case is a page with no
 * entrance animations.
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

    /*
     * Setup waits for window `load` — hydration safety, not performance.
     *
     * `gsap.from` writes its starting styles (opacity 0, translated) onto the
     * element *synchronously at creation*. On a reload with scroll restoration
     * (or a deep link), the page is already scrolled when this chunk arrives —
     * potentially while React is still hydrating — so those writes land on
     * unhydrated server DOM. React then fails hydration on the mismatch, and
     * worse, elements whose trigger already passed can be left stuck at
     * opacity 0 (the footer credit vanished exactly this way).
     *
     * Hydration of the initial HTML always precedes `load`, so creating every
     * tween at-or-after load makes every write post-hydration by construction.
     * The fallback timer covers a stalled load event; the worst case stays a
     * page with no entrance animations — visible content, matching the `from`
     * philosophy above. Late layout (fonts, canvas) still shifts trigger
     * positions afterwards, hence the delayed refresh.
     */
    let ctx: ReturnType<typeof gsap.context> | null = null;
    let delayed = 0;
    const run = (): void => {
      if (ctx) return;
      window.clearTimeout(fallback);
      window.removeEventListener("load", run);
      ctx = gsap.context(() => {
        createReveals();
        createHeroExit();
      });
      delayed = window.setTimeout(() => ScrollTrigger.refresh(), 2500);
    };
    const fallback = window.setTimeout(run, 5000);
    if (document.readyState === "complete") run();
    else window.addEventListener("load", run);
    return () => {
      window.clearTimeout(fallback);
      window.clearTimeout(delayed);
      window.removeEventListener("load", run);
      ctx?.revert();
      ctx = null;
    };
  });

  // Renders nothing: the targets already exist in the server HTML and are found
  // by attribute. Returning null keeps this a pure enhancement layer.
  return null;
}

/**
 * Entrance reveals, groups and media landings. Runs inside a `gsap.context`
 * owned by the component above — only ever at-or-after window `load`, so
 * every `gsap.from` write lands on hydrated DOM (see the hydration note
 * above). Context revert on unmount removes every tween and trigger.
 */
function createReveals(): void {
  gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
    // Responsive variants render twice (desktop + mobile) with one side
    // `display: none`. Animating the hidden copy is pure waste, so skip it.
    if (!element.offsetParent) return;
    gsap.from(element, {
      y: 28,
      opacity: 0,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: { trigger: element, start: "top 88%", once: true },
    });
  });

  /*
   * Stagger cascades: each `[data-reveal-item]` inside a
   * `[data-reveal-group]` rises in sequence when the group enters.
   */
  gsap.utils.toArray<HTMLElement>("[data-reveal-group]").forEach((group) => {
    if (!group.offsetParent) return;
    const items = group.querySelectorAll<HTMLElement>("[data-reveal-item]");
    if (items.length === 0) return;
    gsap.from(items, {
      y: 22,
      opacity: 0,
      duration: 0.6,
      ease: "power3.out",
      stagger: 0.08,
      scrollTrigger: { trigger: group, start: "top 85%", once: true },
    });
  });

  /*
   * Media landings: frames settle from a slight zoom while fading in.
   * GPU-only (transform + opacity) so it stays smooth on mobile GPUs.
   */
  gsap.utils.toArray<HTMLElement>("[data-reveal-zoom]").forEach((frame) => {
    if (!frame.offsetParent) return;
    gsap.from(frame, {
      y: 32,
      scale: 1.06,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: frame, start: "top 88%", once: true },
    });
  });
}

/**
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
 *
 * Same load-gating as the reveals: a scrubbed timeline evaluates its
 * progress at creation, so on a scroll-restored reload it would write
 * mid-flight transforms onto unhydrated hero DOM.
 */
function createHeroExit(): void {
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
}
