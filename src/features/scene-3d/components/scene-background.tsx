"use client";

import { useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { useUiStore } from "@/lib/store/ui-store";

/*
 * Calm CSS aurora — the global background.
 *
 * Replaces the former fullscreen WebGL particle field: two soft radial glows
 * (cyan identity via theme tokens) faded toward the hero, plus an SVG grain
 * at 4% for texture. Zero JS animation, zero bundle cost, free
 * prefers-reduced-motion support. The constellation in skills-graph remains
 * the single interactive sky: "calm reading, one playground."
 *
 * `threeDEnabled` (terminal `3d --toggle`) still toggles this layer, so the
 * command keeps a visible consumer. Reduced-motion / save-data visitors get
 * the same static layer — there is no heavier variant to fall back from.
 */
function AuroraBackground({ calm }: { calm: boolean }) {
  return (
    <div
      aria-hidden
      data-scene="aurora"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Base vertical wash, stronger near hero, transparent toward footer. */}
      <div className="from-primary/[0.08] dark:from-primary/[0.12] absolute inset-0 bg-linear-to-b via-transparent to-transparent" />
      {/* Cyan glow, reading-start side. */}
      <div
        className={
          "bg-primary/[0.1] dark:bg-primary/[0.14] absolute -top-40 end-[-10%] h-[34rem] w-[34rem] rounded-full blur-3xl " +
          (calm ? "" : "animate-hero-fade")
        }
      />
      {/* Violet secondary glow, opposite corner, fainter. */}
      <div className="absolute top-[30%] start-[-12%] h-[28rem] w-[28rem] rounded-full bg-violet-500/[0.07] blur-3xl dark:bg-violet-400/[0.1]" />
      {/* Film grain for texture. */}
      <div
        className="absolute inset-0 opacity-[0.04] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}

export function SceneBackground() {
  const threeDEnabled = useUiStore((state) => state.threeDEnabled);
  // False through hydration (server snapshot), then the live value — so the
  // first client render matches the SSR HTML exactly.
  const prefersReducedMotion = usePrefersReducedMotion();

  /*
   * Read once in the initializer, not synced in an effect: the value never
   * changes for the lifetime of the page, so there is nothing to subscribe to.
   * Non-standard and Chromium-only, hence the guarded access.
   */
  const [saveData] = useState(
    () =>
      typeof navigator !== "undefined" &&
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData === true,
  );

  // Driven by the terminal's `3d --toggle`.
  if (!threeDEnabled) return null;

  return <AuroraBackground calm={prefersReducedMotion || saveData} />;
}
