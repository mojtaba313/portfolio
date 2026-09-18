"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useUiStore } from "@/lib/store/ui-store";

import {
  DARK,
  FACE_SIZES,
  LIGHT,
  drawBadgeFace,
  drawBrowserFace,
  drawEditorFace,
  drawTreeFace,
  type FaceDraw,
  type WorkspacePalette,
} from "./workspace-faces";

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
 *   terminal, a composed 2D scene carries the same five faces the rig paints
 *   (browser, editor, tree, badges) via the shared painters — no three.js.
 * - If the canvas throws (no WebGL, broken driver), an error boundary swaps
 *   to the same scene instead of taking the hero down.
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

/**
 * Static workspace: the loading state and the 3D-off state.
 *
 * The same five faces the WebGL rig paints — browser, editor, component
 * tree, two tech badges — drawn onto plain `<canvas>` elements with the
 * shared painters from `./workspace-faces` (zero three.js), composed to
 * echo the 3D rig: browser large at back-left, editor front-right, tree
 * top-left, badges floating. No loop, no listeners, no bundle cost beyond
 * canvas API; repaints on theme flip (and once webfonts arrive, so the mono
 * faces never stick in fallback glyphs).
 */
function FaceCanvas({
  draw,
  width,
  height,
  palette,
  className,
}: {
  draw: FaceDraw;
  width: number;
  height: number;
  palette: WorkspacePalette;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let alive = true;
    const paint = (): void => {
      if (!alive) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      draw(ctx, palette, width, height);
    };
    paint();
    // The painters set canvas fonts directly: repaint once the webfont
    // arrives so text never freezes in a fallback face.
    if (typeof document !== "undefined" && document.fonts) {
      void document.fonts.ready.then(paint);
    }
    return () => {
      alive = false;
    };
  }, [draw, width, height, palette]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      dir="ltr"
      className={className ?? "block h-auto w-full"}
    />
  );
}

// Badge painters are stable module constants: inline `drawBadgeFace("…")`
// would recreate the function every render and repaint every time.
const drawTypeScriptBadge = drawBadgeFace("TypeScript");
const drawNextBadge = drawBadgeFace("Next.js");

function WorkspaceFallback() {
  // Same rule as the WebGL canvas: unresolved theme reads as dark, matching
  // `defaultTheme="dark"`.
  const { resolvedTheme } = useTheme();
  const palette = resolvedTheme === "light" ? LIGHT : DARK;
  /*
   * Opaque fills here, sheer in 3D: the rig's faces float over refractive
   * glass bodies, but these canvases composite straight onto the page — a
   * sheer fill would wash out against the background instead of reading as
   * glass. Same painters, flat-context strength.
   */
  const facePalette = useMemo(
    () => ({ ...palette, faceAlpha: 1 }),
    [palette],
  );

  return (
    <div
      aria-hidden
      data-hero-workspace
      className="relative mx-auto h-[440px] w-full max-w-[560px] sm:h-[500px] lg:h-[540px]"
    >
      {/* Browser, large, back. */}
      <div className="absolute top-[16%] left-[13%] w-[70%] -rotate-2 drop-shadow-2xl">
        <FaceCanvas
          draw={drawBrowserFace}
          width={FACE_SIZES.browser.width}
          height={FACE_SIZES.browser.height}
          palette={facePalette}
        />
      </div>
      {/* Component tree, top-left. */}
      <div className="absolute top-[3%] left-[1%] w-[27%] rotate-[-4deg] drop-shadow-xl">
        <FaceCanvas
          draw={drawTreeFace}
          width={FACE_SIZES.tree.width}
          height={FACE_SIZES.tree.height}
          palette={facePalette}
        />
      </div>
      {/* Editor, front-right. */}
      <div className="absolute right-[2%] bottom-[3%] z-10 w-[38%] rotate-[3deg] drop-shadow-2xl">
        <FaceCanvas
          draw={drawEditorFace}
          width={FACE_SIZES.editor.width}
          height={FACE_SIZES.editor.height}
          palette={facePalette}
        />
      </div>
      {/* Badges, floating. */}
      <div className="absolute bottom-[9%] left-[3%] z-10 w-[25%] rotate-[2deg] drop-shadow-lg">
        <FaceCanvas
          draw={drawTypeScriptBadge}
          width={FACE_SIZES.badge.width}
          height={FACE_SIZES.badge.height}
          palette={facePalette}
        />
      </div>
      <div className="absolute top-[7%] right-[9%] z-10 w-[25%] -rotate-3 drop-shadow-lg">
        <FaceCanvas
          draw={drawNextBadge}
          width={FACE_SIZES.badge.width}
          height={FACE_SIZES.badge.height}
          palette={facePalette}
        />
      </div>
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
