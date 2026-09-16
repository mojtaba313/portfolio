"use client";

import { useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/**
 * Shared magnetic wrapper for the finale's interactive elements.
 *
 * The child drifts a fraction of the way toward the cursor while the pointer
 * is over it, then eases back on leave. Same proven technique as the hero's
 * magnetic button: imperative lerped transforms on the DOM node, never
 * through state, so server HTML and first paint stay byte-identical and the
 * loop stops when settled. Coarse pointers and reduced motion leave the
 * child untouched.
 */
export function Magnetic({
  children,
  strength = 0.3,
  className,
}: {
  children: React.ReactNode;
  /** Fraction of the cursor offset applied to the child. */
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const strengthRef = useRef(strength);
  // Synced in an effect, never during render (react-hooks/refs).
  useEffect(() => {
    strengthRef.current = strength;
  }, [strength]);
  const state = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, raf: 0 });

  const interactive = (): boolean =>
    !prefersReducedMotion &&
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches;

  const tick = (): void => {
    const node = ref.current;
    const s = state.current;
    s.raf = 0;
    if (!node) return;
    s.x += (s.targetX - s.x) * 0.16;
    s.y += (s.targetY - s.y) * 0.16;
    node.style.transform =
      Math.abs(s.x) > 0.01 || Math.abs(s.y) > 0.01
        ? `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0)`
        : "";
    if (Math.abs(s.targetX - s.x) > 0.01 || Math.abs(s.targetY - s.y) > 0.01) {
      s.raf = requestAnimationFrame(tick);
    }
  };

  const schedule = (): void => {
    if (state.current.raf === 0) {
      state.current.raf = requestAnimationFrame(tick);
    }
  };

  const handleMove = (event: React.PointerEvent<HTMLSpanElement>): void => {
    if (!interactive() || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const s = state.current;
    const k = strengthRef.current;
    s.targetX = (event.clientX - (rect.left + rect.width / 2)) * k;
    s.targetY = (event.clientY - (rect.top + rect.height / 2)) * k;
    schedule();
  };

  const handleLeave = (): void => {
    state.current.targetX = 0;
    state.current.targetY = 0;
    schedule();
  };

  return (
    <span
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={`inline-flex will-change-transform ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
