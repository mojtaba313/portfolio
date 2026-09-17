"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useState } from "react";

import { fa } from "@/content/fa";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useUiStore } from "@/lib/store/ui-store";

/**
 * The hero's digital environment, rendered as a real Three.js workspace.
 *
 * The canvas itself stays out of the initial bundle and out of SSR behind a
 * dynamic import — exactly like the global scene. What the server renders
 * (the loading shell below) is byte-identical to the first client paint, so
 * there is nothing to hydrate and nothing to mismatch.
 *
 * Two deliberate fallbacks, both static and both honest:
 * - While the WebGL chunk loads, and when the visitor toggled 3D off in the
 *   terminal, a quiet glass panel carries the same editor content.
 * - If the canvas throws (no WebGL, broken driver), an error boundary swaps
 *   to the same panel instead of taking the hero down.
 */

const HeroWorkspaceCanvas = dynamic(
  () =>
    import("./hero-workspace-canvas").then(
      (module) => module.HeroWorkspaceCanvas,
    ),
  {
    ssr: false,
    loading: () => <WorkspaceShell />,
  },
);

function WorkspaceShell() {
  return (
    <div
      aria-hidden
      data-hero-workspace
      className="relative mx-auto h-[440px] w-full max-w-[560px] sm:h-[500px] lg:h-[540px]"
    />
  );
}

/** Static glass panel: the loading state and the 3D-off state. */
function WorkspaceFallback() {
  return (
    <div
      aria-hidden
      data-hero-workspace
      className="bg-card/70 border-border/70 relative mx-auto h-[440px] w-full max-w-[560px] overflow-hidden rounded-xl border shadow-2xl backdrop-blur-md sm:h-[500px] lg:h-[540px]"
    >
      <div className="border-border/60 flex items-center justify-between border-b px-4 py-2.5">
        <span
          dir="ltr"
          className="font-mono text-[11px] text-muted-foreground"
        >
          {fa.home.heroCodeFile}
        </span>
        <span className="bg-primary size-1.5 rounded-full shadow-[0_0_8px_var(--primary)]" />
      </div>
      <pre
        dir="ltr"
        className="overflow-x-auto p-5 font-mono text-[13px] leading-loose"
      >
        {fa.home.heroCode.map((line, i) => (
          <span key={`${i}-${line}`} className="flex gap-4 whitespace-pre">
            <span
              aria-hidden
              className="text-muted-foreground/40 w-4 shrink-0 text-right select-none"
            >
              {i + 1}
            </span>
            <code className="text-foreground/85">{line}</code>
          </span>
        ))}
      </pre>
    </div>
  );
}

class WorkspaceErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function HeroVisual() {
  const threeDEnabled = useUiStore((state) => state.threeDEnabled);
  // False through hydration, then the live value — the swap to a static
  // frame happens after hydration, never during it.
  const prefersReducedMotion = usePrefersReducedMotion();
  /*
   * Read once: pointer class never changes for the lifetime of the page, so
   * there is nothing to subscribe to. Server-safe by construction — this
   * branch only decides which client-only canvas variant mounts.
   */
  const [finePointer] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: fine)").matches,
  );

  if (!threeDEnabled || prefersReducedMotion) return <WorkspaceFallback />;

  return (
    <div
      aria-hidden
      data-hero-workspace
      className="relative mx-auto h-[440px] w-full max-w-[560px] sm:h-[500px] lg:h-[540px]"
    >
      <WorkspaceErrorBoundary fallback={<WorkspaceFallback />}>
        <HeroWorkspaceCanvas
          animated={!prefersReducedMotion}
          interactive={finePointer}
        />
      </WorkspaceErrorBoundary>
    </div>
  );
}
