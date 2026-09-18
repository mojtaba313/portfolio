"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll choreography for the project journey (desktop only).
 *
 * The section markup is a Server Component; this chunk loads lazily behind
 * the `ProjectJourneyLoader` dynamic boundary so GSAP never joins the
 * initial bundle. All queries are scoped to the desktop stage, so the
 * mobile list is never touched. Without JS or under reduced motion the
 * stage stays a static first-project view (see the `opacity-0` fallbacks
 * in `projects-section.tsx`).
 *
 * Setup waits for window `load`: `gsap.set` writes starting styles and pin
 * creation restructures the DOM (pin-spacer), both synchronously. Running
 * those at chunk-arrival time races React hydration — a normal visit lands
 * on this section seconds before hydration finishes in dev — and lands as a
 * hydration mismatch. Hydration of the initial HTML always precedes `load`,
 * so starting there is safe by construction; the static first-project view
 * covers the wait indistinguishably.
 */
export function ProjectJourneyAnimator() {
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ctx: ReturnType<typeof gsap.context> | null = null;
    const run = (): void => {
      if (ctx) return;
      window.clearTimeout(fallback);
      window.removeEventListener("load", run);
      const stage = document.querySelector<HTMLElement>("[data-project-stage]");
      if (!stage) return;
      ctx = gsap.context(() => {
        choreograph(stage);
      });
    };
    // `load` can stall on a slow asset while hydration finished long ago;
    // the journey must still initialise, so fall back to a bounded wait.
    const fallback = window.setTimeout(run, 8000);
    if (document.readyState === "complete") run();
    else window.addEventListener("load", run);
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener("load", run);
      ctx?.revert();
      ctx = null;
    };
  });

  return null;
}

/**
 * Builds the pinned scrubbed timeline for a hydrated stage. Runs inside a
 * `gsap.context` owned by the component above, so unmount reverts every
 * tween, trigger and pin it creates.
 */

function choreograph(stage: HTMLElement): void {
  // Scoped selector: never match the mobile list or another instance.
  const select = <T extends HTMLElement>(selector: string) =>
    gsap.utils.toArray<T>(selector, stage);

  const panels = select("[data-project-panel]");
  if (panels.length < 2) return;
  const details = select("[data-project-details]");
  const dots = select("[data-project-dot]");
  const marks = select("[data-project-dot-mark]");
  const current = stage.querySelector<HTMLElement>("[data-project-current]");
  const progress = stage.querySelector<HTMLElement>("[data-project-progress]");

  const total = panels.length;
  const label = (index: number) => String(index + 1).padStart(2, "0");

  // Keep focus order and screen readers on the visible panel only.
  const syncAccessibility = (index: number) => {
    details.forEach((panel, i) => {
      const hidden = i !== index;
      if (panel.inert !== hidden) panel.inert = hidden;
      if (panel.getAttribute("aria-hidden") !== String(hidden)) {
        panel.setAttribute("aria-hidden", String(hidden));
      }
    });
  };

  // Counter + rail + progress + a11y, fired in sync with the scrubbed
  // playhead (not the raw scroll position) so the readout always matches the
  // visuals. Rail state rides on `data-active`, which Tailwind's
  // `group-data-*` variants style — no class juggling per tick.
  const syncActiveProject = (index: number, elapsed: number, duration: number) => {
    if (current) current.textContent = label(index);
    dots.forEach((dot, i) => {
      const active = String(i === index);
      if (dot.dataset.active !== active) dot.dataset.active = active;
    });
    if (progress) {
      progress.style.width = `${Math.min(100, (elapsed / duration) * 100)}%`;
    }
    syncAccessibility(index);
  };

  const media = gsap.matchMedia();

  media.add("(min-width: 1024px)", () => {
    gsap.set(panels.slice(1), { opacity: 0, scale: 0.92, x: 80, y: 20 });
    gsap.set(details.slice(1), { opacity: 0, x: 30 });
    syncActiveProject(0, 0, 1);

    const segmentEnds: number[] = [];

    const timeline = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      scrollTrigger: {
        trigger: stage,
        start: "top top",
        // Tighter pin distance than before: every project still gets a full
        // viewport plus dwell time, but the showcase no longer reads as a
        // hijack on a 3-project list.
        // NOTE: relative `end` strings only parse px (a "vh" suffix is
        // silently dropped), so viewport units must be resolved to px here.
        end: () => `+=${total * 1.1 * window.innerHeight}`,
        pin: true,
        scrub: 0.5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate() {
          // Map the scrubbed playhead (not the raw scroll position) to the
          // active project, so the readout can never disagree with the
          // visuals — even mid-teleport or mid-catch-up.
          const elapsed = timeline.time();
          const settled = segmentEnds.findIndex((end) => elapsed < end);
          syncActiveProject(
            settled === -1 ? total - 1 : settled,
            elapsed,
            timeline.duration(),
          );
        },
      },
    });

    // Rail jump buttons ask for a project by index; translate that into the
    // scroll position whose playhead shows it, and let the scrub carry the
    // stage there. Returned cleanup runs when the matchMedia reverts.
    const onJump = (event: Event) => {
      const index = (event as CustomEvent<number>).detail;
      if (typeof index !== "number" || index < 0 || index >= total) return;
      const trigger = timeline.scrollTrigger;
      if (!trigger) return;
      const target = index === 0 ? 0 : segmentEnds[index - 1] + 0.15;
      const fraction = Math.min(0.999, target / timeline.duration());
      window.scrollTo({
        top: trigger.start + fraction * (trigger.end - trigger.start),
        behavior: "auto",
      });
    };
    window.addEventListener("portfolio:project-jump", onJump);

    panels.slice(1).forEach((_, position) => {
      const previous = position;
      const next = position + 1;

      // Dwell on the current project before its exit starts, so every
      // project gets quiet reading time instead of rushing into the next.
      timeline.to({}, { duration: 1 });
      const at = timeline.duration();

      timeline
        .to(
          panels[previous],
          { opacity: 0, scale: 0.94, x: -70, force3D: true, duration: 1 },
          at,
        )
        .to(
          details[previous],
          { opacity: 0, x: -30, force3D: true, duration: 0.7 },
          at,
        )
        .to(marks[previous], { scale: 0.7, opacity: 0.35, duration: 0.3 }, at)
        .to(
          panels[next],
          { opacity: 1, scale: 1, x: 0, y: 0, force3D: true, duration: 1 },
          at + 0.15,
        )
        .to(
          details[next],
          { opacity: 1, x: 0, force3D: true, duration: 0.7 },
          at + 0.35,
        )
        .to(
          marks[next],
          { scale: 1.35, opacity: 1, duration: 0.3 },
          at + 0.35,
        );

      // Boundary past which `next` counts as the active project: the
      // midpoint of its arrival, i.e. the moment it starts dominating
      // the outgoing panel.
      segmentEnds.push(at + 0.65);
    });

    // Trailing dwell so the final project can be read before unpinning.
    timeline.to({}, { duration: 1 });

    /*
     * Pinning restructures the document (pin-spacer), which moves every
     * trigger below the stage — including the reveal animations owned by the
     * scroll-animations chunk. That chunk refreshes on a timer, but the pin
     * can land minutes later (its loader waits for the stage to approach),
     * so refresh here too: after setup, and on revert when the spacer is
     * removed. Without this, below-pin triggers keep pre-pin positions and
     * the last ones can become unreachable entirely.
     */
    ScrollTrigger.refresh();

    return () => {
      window.removeEventListener("portfolio:project-jump", onJump);
      ScrollTrigger.refresh();
    };
  });
}
