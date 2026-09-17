"use client";

import { useReducedMotion } from "motion/react";
import { useRef } from "react";

/**
 * Subtle magnetic wrapper for CTAs.
 *
 * The child drifts a fraction of the way toward the cursor while the pointer
 * is over it, then eases back on leave. Strength is deliberately low (0.25):
 * the button should feel like it has mass, not like it is chasing the mouse.
 *
 * Transforms are applied imperatively to the DOM node, never through props or
 * state — so server HTML and first paint are byte-identical and there is
 * nothing to hydrate. (A MotionValue in `style` renders different markup on
 * the client than on the server and throws a hydration error; this is the
 * second component in this feature rewritten for exactly that reason.) The
 * lerp loop stops when settled: no perpetual animation frame.
 *
 * Guards: coarse pointers (touch has no hover to track) and reduced motion
 * (any movement is the thing being avoided) both leave the child untouched.
 */
export function MagneticButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const state = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, raf: 0 });

  const interactive = () =>
    !prefersReducedMotion &&
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches;

  const tick = () => {
    const node = ref.current;
    const s = state.current;
    s.raf = 0;
    if (!node) return;
    s.x += (s.targetX - s.x) * 0.18;
    s.y += (s.targetY - s.y) * 0.18;
    node.style.transform =
      Math.abs(s.x) > 0.01 || Math.abs(s.y) > 0.01
        ? `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0)`
        : "";
    if (
      Math.abs(s.targetX - s.x) > 0.01 ||
      Math.abs(s.targetY - s.y) > 0.01
    ) {
      s.raf = requestAnimationFrame(tick);
    }
  };

  const schedule = () => {
    if (state.current.raf === 0) {
      state.current.raf = requestAnimationFrame(tick);
    }
  };

  const handleMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (!interactive() || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const s = state.current;
    s.targetX = (event.clientX - (rect.left + rect.width / 2)) * 0.25;
    s.targetY = (event.clientY - (rect.top + rect.height / 2)) * 0.25;
    schedule();
  };

  const handleLeave = () => {
    state.current.targetX = 0;
    state.current.targetY = 0;
    schedule();
  };

  return (
    <span
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className="inline-flex"
    >
      {children}
    </span>
  );
}
