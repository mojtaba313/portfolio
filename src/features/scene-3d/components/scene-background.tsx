"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { useUiStore } from "@/lib/store/ui-store";

import type { SceneScheme } from "./scene-canvas";

/*
 * three.js and react-three-fiber stay out of the initial bundle behind this
 * dynamic import. The wrapper itself is a few lines and mounts in the layout;
 * the ~200KB of WebGL only downloads when the scene actually renders.
 */
const SceneCanvas = dynamic(
  () => import("./scene-canvas").then((module) => module.SceneCanvas),
  { ssr: false },
);

/*
 * Concrete values because three.js takes colours, not CSS classes. Mapped from
 * the theme tokens: cyan-300/cyan-800 are the bright and deep ends of
 * --primary's cyan, teal-950 a near-black with a cyan cast for depth grading.
 * If the palette hue ever changes, this is the one place that follows it.
 *
 * Additive blending on a light page washes toward white, so the light scheme
 * composites normally with darker inks instead.
 */
const SCENE_SCHEMES: Record<"dark" | "light", SceneScheme> = {
  dark: {
    bright: "#67e8f9",
    deep: "#155e75",
    opacity: 0.32,
    lineOpacity: 0.045,
    glowOpacity: 0.06,
    additive: true,
  },
  light: {
    bright: "#0e7490",
    deep: "#67e8f9",
    opacity: 0.24,
    lineOpacity: 0.07,
    glowOpacity: 0.04,
    additive: false,
  },
};

/**
 * Static gradient shown instead of the canvas.
 *
 * Covers reduced-motion users (no animation at all), save-data users (no
 * ~200KB download), and, should WebGL ever be unavailable, whatever remains.
 * It still carries the cyan identity in both modes through the theme tokens.
 */
function GradientFallback() {
  return (
    <div
      aria-hidden
      data-scene="fallback"
      className="from-primary/10 dark:from-primary/15 pointer-events-none fixed inset-0 -z-10 bg-linear-to-b via-transparent to-transparent"
    />
  );
}

export function SceneBackground() {
  const threeDEnabled = useUiStore((state) => state.threeDEnabled);
  const { resolvedTheme } = useTheme();
  // False through hydration (server snapshot), then the live value — so the
  // first client render matches the SSR HTML exactly.
  const prefersReducedMotion = usePrefersReducedMotion();

  /*
   * Read once in the initializer, not synced in an effect: the value never
   * changes for the lifetime of the page, so there is nothing to subscribe to
   * (and an effect that just sets state trips the setState-in-effect rule).
   * Non-standard and Chromium-only, hence the guarded access — where it is
   * absent there is simply no signal. One caveat: on the server this is always
   * false, so a save-data visitor gets a hydration mismatch on this subtree
   * and React reconciles to the fallback. No crash, no flash of canvas — just
   * a dev-only warning for a rare cohort.
   */
  const [saveData] = useState(
    () =>
      typeof navigator !== "undefined" &&
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData === true,
  );

  // Driven by the terminal's `3d --toggle`, which has set this flag since
  // step 2 — this component is the consumer that flag was waiting for.
  if (!threeDEnabled) return null;
  if (prefersReducedMotion || saveData) return <GradientFallback />;

  const scheme =
    resolvedTheme === "light" ? SCENE_SCHEMES.light : SCENE_SCHEMES.dark;

  return (
    <div
      aria-hidden
      data-scene="canvas"
      className="pointer-events-none fixed inset-0 -z-10"
    >
      <SceneCanvas scheme={scheme} />
    </div>
  );
}
