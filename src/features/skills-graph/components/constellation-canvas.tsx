"use client";

import { useEffect, useRef } from "react";

import { fa } from "@/content/fa";
import type { GraphData } from "@/lib/db/projects";

import {
  buildConstellation,
  layoutConstellation,
  type ConstellationModel,
} from "../lib/constellation-layout";
import { resolveCategoryPalette } from "../lib/graph-theme";

/**
 * Tech Constellation canvas.
 *
 * Deliberately Canvas 2D, not Three.js/R3F: the layout already mounts two
 * WebGL contexts (the global scene background and the hero workspace), and a
 * third context for typographic dots would risk context loss and ~200KB of
 * download for no visual gain. Glow, depth and glass are all achievable with
 * gradients and layered strokes at a fraction of the cost — and canvas text
 * renders Latin skill names crisply, which WebGL sprites never do.
 *
 * Physics is bespoke springs, not d3-force: a hub topology needs no
 * all-pairs repulsion, so every frame is O(n) — a per-node spring toward a
 * magnetic target — and the loop can idle, throttle, or pause entirely.
 */

const CANVAS_HEIGHT = 460;
const MAGNET_RADIUS = 210;
const MAX_PULL = 32;
const STIFFNESS = 0.075;
const DAMPING = 0.86;

type Runtime = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  alpha: number;
  phase: number;
};

type Star = { x: number; y: number; r: number; base: number; speed: number; phase: number };

function mulberry(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

type Rgb = readonly [number, number, number];

const rgbCache = new Map<string, Rgb>();
let probeCtx: CanvasRenderingContext2D | null | undefined;

/**
 * Normalises any CSS colour to sRGB channels.
 *
 * Node colours come from two worlds: hex strings in the database (`#3178c6`)
 * and live theme tokens (`--category-*`) that resolve to `lab(...)`. Naive
 * alpha tricks like `` `${color}66` `` only parse for hex and throw
 * `SyntaxError` inside `addColorStop` for functional colours — crashing the
 * whole frame. Probing through a 1×1 canvas lets the browser do the parsing
 * once per distinct colour (cached), so gradients always get valid `rgba()`.
 */
function rgbOf(color: string): Rgb {
  const cached = rgbCache.get(color);
  if (cached) return cached;

  let rgb: Rgb = [115, 115, 115];
  if (probeCtx === undefined) {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    probeCtx = probe.getContext("2d", { willReadFrequently: true });
  }
  if (probeCtx) {
    probeCtx.clearRect(0, 0, 1, 1);
    probeCtx.fillStyle = color;
    probeCtx.fillRect(0, 0, 1, 1);
    const data = probeCtx.getImageData(0, 0, 1, 1).data;
    rgb = [data[0] ?? 115, data[1] ?? 115, data[2] ?? 115];
  }
  rgbCache.set(color, rgb);
  return rgb;
}

export function ConstellationCanvas({
  data,
  dark,
  staticLayout,
  selectedId,
  hoveredId,
  categoryFilter,
  onHover,
  onSelect,
}: {
  data: GraphData;
  dark: boolean;
  staticLayout: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  categoryFilter: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selectedRef = useRef(selectedId);
  const hoveredRef = useRef(hoveredId);
  const filterRef = useRef(categoryFilter);
  const selectRef = useRef(onSelect);
  const hoverCbRef = useRef(onHover);
  /** One fresh frame on demand — the reduced-motion repaint path. */
  const drawStaticRef = useRef<() => void>(() => {});

  // Synced in an effect (never during render): the canvas loop reads these
  // refs so interaction never rebuilds the engine or restarts the loop.
  useEffect(() => {
    selectedRef.current = selectedId;
    hoveredRef.current = hoveredId;
    filterRef.current = categoryFilter;
    selectRef.current = onSelect;
    hoverCbRef.current = onHover;
    if (staticLayout) {
      // Highlighting is an instant state change, not motion: repaint so
      // keyboard/pointer selection stays visible without an animation loop.
      const repaint = requestAnimationFrame(() => drawStaticRef.current());
      return () => cancelAnimationFrame(repaint);
    }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const model: ConstellationModel = buildConstellation(
      data,
      resolveCategoryPalette(),
    );
    const byId = new Map(model.nodes.map((node) => [node.id, node]));
    const neighbours = new Map<string, Set<string>>();
    for (const edge of model.edges) {
      if (!neighbours.get(edge.sourceId))
        neighbours.set(edge.sourceId, new Set());
      if (!neighbours.get(edge.targetId))
        neighbours.set(edge.targetId, new Set());
      neighbours.get(edge.sourceId)!.add(edge.targetId);
      neighbours.get(edge.targetId)!.add(edge.sourceId);
    }

    const runtime = new Map<string, Runtime>();
    const rand = mulberry(42);
    const fit = (): { width: number; dpr: number } => {
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        container.clientWidth < 560 ? 1.4 : 1.6,
      );
      const width = container.clientWidth;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(CANVAS_HEIGHT * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${CANVAS_HEIGHT}px`;
      return { width, dpr };
    };

    let { width, dpr } = fit();
    layoutConstellation(model, width, CANVAS_HEIGHT);

    // Deterministic starfield, regenerated on resize.
    let stars: Star[] = [];
    const seedStars = (w: number): void => {
      const local = mulberry(7);
      stars = Array.from({ length: 110 }, () => ({
        x: local() * w,
        y: local() * CANVAS_HEIGHT,
        r: 0.4 + local() * 1.1,
        base: 0.12 + local() * 0.4,
        speed: 0.4 + local() * 1.2,
        phase: local() * Math.PI * 2,
      }));
    };
    seedStars(width);

    for (const node of model.nodes) {
      // Bloom start: every star begins at the hub with a whisper of jitter,
      // so the reveal springs outward and settles instead of fading in place.
      // The reduced-motion path snaps to home below and never animates.
      const hub = byId.get("core");
      runtime.set(node.id, {
        x: (hub?.homeX ?? node.homeX) + (rand() - 0.5) * 28,
        y: (hub?.homeY ?? node.homeY) + (rand() - 0.5) * 28,
        vx: 0,
        vy: 0,
        scale: 1,
        alpha: 1,
        phase: rand() * Math.PI * 2,
      });
    }
    if (staticLayout) {
      for (const node of model.nodes) {
        const state = runtime.get(node.id);
        if (state) {
          state.x = node.homeX;
          state.y = node.homeY;
        }
      }
    }

    const ink = dark ? "#f4f4f5" : "#18181b";
    const faintInk = dark ? "rgba(244,244,245,0.55)" : "rgba(24,24,27,0.6)";
    const coreEdge = dark
      ? "rgba(34,211,238,0.55)"
      : "rgba(14,116,144,0.45)";
    const tieEdge = dark
      ? "rgba(167,139,250,0.20)"
      : "rgba(109,40,217,0.18)";

    let pointer: { x: number; y: number } | null = null;
    let pointerActive = false;
    let visible = true;
    let raf = 0;
    let frame = 0;
    const startTime = performance.now();

    const pickNode = (x: number, y: number): string | null => {
      let best: string | null = null;
      let bestDistance = Infinity;
      const touchBonus =
        window.matchMedia("(pointer: coarse)").matches ? 10 : 0;
      for (const node of model.nodes) {
        const state = runtime.get(node.id);
        if (!state || state.alpha < 0.3) continue;
        const hit = node.radius * state.scale + 12 + touchBonus;
        const distance = Math.hypot(state.x - x, state.y - y);
        if (distance <= hit && distance < bestDistance) {
          best = node.id;
          bestDistance = distance;
        }
      }
      return best;
    };

    const focusId = (): string | null =>
      hoveredRef.current ?? selectedRef.current;

    const draw = (now: number): void => {
      const elapsed = (now - startTime) / 1000;
      const revealT = staticLayout ? 1 : Math.min(1, elapsed / 1.9);
      const w = container.clientWidth;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, CANVAS_HEIGHT);

      // Deep-space backdrop inside the canvas (the card behind adds glass).
      const bg = ctx.createRadialGradient(
        w / 2,
        CANVAS_HEIGHT / 2,
        40,
        w / 2,
        CANVAS_HEIGHT / 2,
        Math.max(w, CANVAS_HEIGHT) * 0.7,
      );
      if (dark) {
        bg.addColorStop(0, "rgba(34,211,238,0.06)");
        bg.addColorStop(0.55, "rgba(76,29,149,0.05)");
        bg.addColorStop(1, "rgba(0,0,0,0)");
      } else {
        bg.addColorStop(0, "rgba(34,211,238,0.10)");
        bg.addColorStop(0.6, "rgba(167,139,250,0.08)");
        bg.addColorStop(1, "rgba(255,255,255,0)");
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, CANVAS_HEIGHT);

      // Stars.
      for (const star of stars) {
        const twinkle =
          staticLayout || !visible
            ? 0
            : Math.sin(elapsed * star.speed + star.phase) * 0.12;
        ctx.globalAlpha = Math.max(0.04, star.base + twinkle) * revealT;
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const core = byId.get("core");
      const cx = core?.homeX ?? w / 2;
      const cy = core?.homeY ?? CANVAS_HEIGHT / 2;
      const unit = Math.min(w, CANVAS_HEIGHT);

      // Orbit rings.
      ctx.save();
      ctx.globalAlpha = 0.5 * revealT;
      ctx.strokeStyle = dark
        ? "rgba(255,255,255,0.07)"
        : "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      for (const fraction of [0.21, 0.38]) {
        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy,
          unit * fraction * (w < 560 ? 0.86 : 1),
          unit * fraction * 0.92,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      // Slow rotating dashed halo around the core — the only perpetual
      // rotation, and it freezes under reduced motion.
      if (!staticLayout) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(elapsed * 0.12);
        ctx.strokeStyle = coreEdge;
        ctx.setLineDash([4, 7]);
        ctx.globalAlpha = 0.65 * revealT;
        ctx.beginPath();
        ctx.arc(0, 0, (core?.radius ?? 30) + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      const focus = focusId();
      const focusNeighbours = focus
        ? (neighbours.get(focus) ?? new Set<string>())
        : new Set<string>();
      const edgeT = staticLayout
        ? 1
        : easeOutCubic(Math.min(1, Math.max(0, (revealT - 0.3) / 0.7)));

      const isDimmed = (id: string): boolean => {
        const filter = filterRef.current;
        if (!filter) return false;
        if (id === "core") return false;
        return byId.get(id)?.category !== filter;
      };

      // Edges under nodes. Core links sweep in with edgeT (connections form
      // after nodes appear); ties fade in last.
      for (const edge of model.edges) {
        const a = byId.get(edge.sourceId);
        const b = byId.get(edge.targetId);
        const ra = a ? runtime.get(a.id) : undefined;
        const rb = b ? runtime.get(b.id) : undefined;
        if (!a || !b || !ra || !rb) continue;
        const incident =
          focus !== null &&
          (edge.sourceId === focus || edge.targetId === focus);
        const progress =
          edge.kind === 0
            ? edgeT
            : edgeT * (focus === null || incident ? 1 : 0.6);
        if (progress <= 0.01) continue;
        const mx = ra.x + (rb.x - ra.x) * progress;
        const my = ra.y + (rb.y - ra.y) * progress;
        const dimmed =
          (focus !== null && !incident) ||
          isDimmed(edge.sourceId) ||
          isDimmed(edge.targetId);
        if (edge.kind === 0) {
          ctx.strokeStyle = incident ? "rgba(34,211,238,0.85)" : coreEdge;
          ctx.globalAlpha = (dimmed ? 0.15 : incident ? 1 : 0.6) * edgeT;
          ctx.lineWidth = incident ? 1.6 : 1;
        } else {
          ctx.strokeStyle = tieEdge;
          ctx.globalAlpha = (dimmed ? 0.1 : incident ? 0.8 : 0.55) * edgeT;
          ctx.lineWidth = incident ? 1.2 : 1;
          ctx.setLineDash([2, 5]);
        }
        ctx.beginPath();
        ctx.moveTo(ra.x, ra.y);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Nodes.
      for (const node of model.nodes) {
        const state = runtime.get(node.id);
        if (!state) continue;
        const delay = 0.08 + Math.max(0, node.order) * 0.045;
        const local = staticLayout
          ? 1
          : easeOutCubic(
              Math.min(1, Math.max(0, (revealT - delay) / 0.45)),
            );
        state.alpha = local;
        if (local <= 0.01) continue;

        const isFocus = focus === node.id;
        const isNeighbour =
          focus !== null && focusNeighbours.has(node.id);
        const targetScale = isFocus ? 1.35 : isNeighbour ? 1.15 : 1;
        state.scale += (targetScale - state.scale) * 0.18;

        const dimmed =
          isDimmed(node.id) ||
          (focus !== null && !isFocus && !isNeighbour);
        const alpha = local * (dimmed ? 0.25 : 1);

        const r = node.radius * state.scale;
        ctx.globalAlpha = alpha;

        if (node.kind === "core") {
          // Glass hub: layered fills + inner highlight, no shadowBlur.
          const halo = ctx.createRadialGradient(
            state.x,
            state.y,
            r * 0.4,
            state.x,
            state.y,
            r * 2.1,
          );
          halo.addColorStop(0, "rgba(34,211,238,0.35)");
          halo.addColorStop(0.5, "rgba(167,139,250,0.12)");
          halo.addColorStop(1, "rgba(34,211,238,0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(state.x, state.y, r * 2.1, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = dark
            ? "rgba(8,15,25,0.92)"
            : "rgba(255,255,255,0.92)";
          ctx.beginPath();
          ctx.arc(state.x, state.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isFocus
            ? "rgba(34,211,238,1)"
            : "rgba(34,211,238,0.7)";
          ctx.lineWidth = isFocus ? 2.4 : 1.6;
          ctx.stroke();
          ctx.strokeStyle = "rgba(167,139,250,0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(state.x, state.y, r - 5, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = ink;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "700 13px 'Geist Mono', ui-monospace, monospace";
          ctx.fillText(fa.skills.coreName, state.x, state.y - 5);
          ctx.font = "500 8.5px 'Geist Mono', ui-monospace, monospace";
          ctx.globalAlpha = alpha * 0.75;
          ctx.fillStyle = dark ? "#67e8f9" : "#0e7490";
          ctx.fillText(fa.skills.coreRole, state.x, state.y + 10);
          ctx.globalAlpha = alpha;
        } else {
          if (isFocus) {
            const [hr, hg, hb] = rgbOf(node.color);
            const halo = ctx.createRadialGradient(
              state.x,
              state.y,
              r * 0.3,
              state.x,
              state.y,
              r * 2.6,
            );
            halo.addColorStop(0, `rgba(${hr}, ${hg}, ${hb}, 0.4)`);
            halo.addColorStop(1, `rgba(${hr}, ${hg}, ${hb}, 0)`);
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(state.x, state.y, r * 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = node.color;
          ctx.beginPath();
          ctx.arc(state.x, state.y, r, 0, Math.PI * 2);
          ctx.fill();
          // Glass highlight.
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.beginPath();
          ctx.arc(
            state.x - r * 0.3,
            state.y - r * 0.35,
            r * 0.32,
            0,
            Math.PI * 2,
          );
          ctx.fill();

          if (isFocus) {
            ctx.strokeStyle = dark
              ? "rgba(255,255,255,0.9)"
              : "rgba(0,0,0,0.7)";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(state.x, state.y, r + 4, 0, Math.PI * 2);
            ctx.stroke();
          }

          const showLabel =
            isFocus ||
            isNeighbour ||
            node.orbit === 0 ||
            selectedRef.current === node.id;
          if (showLabel) {
            ctx.font = "500 10.5px 'Geist Mono', ui-monospace, monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = faintInk;
            ctx.globalAlpha = alpha * (isFocus || isNeighbour ? 1 : 0.8);
            ctx.fillText(node.label, state.x, state.y + r + 5, 120);
            ctx.globalAlpha = alpha;
          }
        }
        ctx.globalAlpha = 1;
      }
    };

    drawStaticRef.current = () => draw(performance.now());

    const step = (now: number): void => {
      frame++;
      // Idle throttle: after the reveal, with no pointer and no focus, every
      // second frame is plenty for twinkle and breathing.
      const idle =
        (now - startTime) / 1000 > 2 &&
        !pointerActive &&
        focusId() === null;
      if (!idle || frame % 2 === 0) {
        if (!staticLayout) {
          const pull = new Map<string, { x: number; y: number }>();
          for (const node of model.nodes) {
            const state = runtime.get(node.id);
            if (!state) continue;
            let px = 0;
            let py = 0;
            if (pointer && state.alpha > 0.3) {
              const dx = pointer.x - state.x;
              const dy = pointer.y - state.y;
              const d = Math.hypot(dx, dy);
              if (d < MAGNET_RADIUS && d > 0.5) {
                const falloff = Math.pow(1 - d / MAGNET_RADIUS, 2);
                const cap =
                  node.kind === "core" ? 7 : MAX_PULL * (node.orbit === 0 ? 0.85 : 1);
                px = (dx / d) * falloff * cap;
                py = (dy / d) * falloff * cap;
              }
            }
            pull.set(node.id, { x: px, y: py });
          }
          // Secondary reaction: tied skills inherit a whisper of each
          // other's pull, so plucking one star stirs its neighbours.
          for (const edge of model.edges) {
            if (edge.kind !== 1) continue;
            const a = pull.get(edge.sourceId);
            const b = pull.get(edge.targetId);
            if (!a || !b) continue;
            a.x += b.x * 0.12;
            a.y += b.y * 0.12;
            b.x += a.x * 0.12;
            b.y += a.y * 0.12;
          }
          const t = now / 1000;
          for (const node of model.nodes) {
            const state = runtime.get(node.id);
            const p = pull.get(node.id);
            if (!state || !p) continue;
            const breath =
              node.kind === "core"
                ? 0
                : Math.sin(t * 0.9 + state.phase) * 1.6;
            const tx = node.homeX + p.x;
            const ty = node.homeY + p.y + breath * 0.4;
            // Outer stars travel further on reveal, so they spring softer and
            // arrive a beat later — the settle reads as a wave, not a pop.
            const stiffness =
              node.kind === "core"
                ? 0.09
                : node.orbit === 0
                  ? STIFFNESS
                  : 0.06;
            state.vx = (state.vx + (tx - state.x) * stiffness) * DAMPING;
            state.vy = (state.vy + (ty - state.y) * stiffness) * DAMPING;
            state.x += state.vx;
            state.y += state.vy;
          }
        }
        draw(now);
      }
      raf = requestAnimationFrame(step);
    };

    const start = (): void => {
      if (raf || staticLayout) return;
      raf = requestAnimationFrame(step);
    };
    const stop = (): void => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onPointerMove = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      pointerActive = true;
      const id = pickNode(pointer.x, pointer.y);
      if (id !== hoveredRef.current) {
        hoverCbRef.current(id);
        canvas.style.cursor = id ? "pointer" : "default";
      }
      start();
    };
    const onPointerLeave = (): void => {
      pointer = null;
      pointerActive = false;
      if (hoveredRef.current !== null) hoverCbRef.current(null);
      canvas.style.cursor = "default";
    };
    const onClick = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const id = pickNode(
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      if (id === null) {
        selectRef.current(null);
        return;
      }
      if (id === "core") {
        selectRef.current(null);
        return;
      }
      selectRef.current(
        selectedRef.current === id ? null : id,
      );
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      const order = model.nodes.filter((node) => node.kind === "skill");
      if (order.length === 0) return;
      if (
        event.key === "ArrowRight" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowUp"
      ) {
        event.preventDefault();
        const direction =
          event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
        const current = order.findIndex(
          (node) => node.id === hoveredRef.current,
        );
        const next =
          order[(current + direction + order.length) % order.length]!;
        hoverCbRef.current(next.id);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const id = hoveredRef.current;
        if (id && id !== "core")
          selectRef.current(selectedRef.current === id ? null : id);
        return;
      }
      if (event.key === "Escape") {
        hoverCbRef.current(null);
        selectRef.current(null);
      }
    };

    const onResize = (): void => {
      const next = fit();
      width = next.width;
      dpr = next.dpr;
      layoutConstellation(model, width, CANVAS_HEIGHT);
      seedStars(width);
      if (staticLayout) {
        for (const node of model.nodes) {
          const state = runtime.get(node.id);
          if (state) {
            state.x = node.homeX;
            state.y = node.homeY;
          }
        }
        draw(performance.now());
      }
    };

    const visibility = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) {
          if (staticLayout) draw(performance.now());
          else start();
        } else {
          stop();
        }
      },
      { threshold: 0.05 },
    );
    visibility.observe(container);

    const onVisibilityChange = (): void => {
      if (document.hidden) stop();
      else if (visible) {
        if (staticLayout) draw(performance.now());
        else start();
      }
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (staticLayout) {
      draw(performance.now());
    } else {
      start();
    }

    return () => {
      stop();
      visibility.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // Rebuild on theme/data/motion-path change. Hover/selection/filter flow
    // through refs so interacting never restarts the loop.
  }, [data, dark, staticLayout]);

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        role="img"
        tabIndex={0}
        aria-label={`${fa.skills.canvasLabel(
          data.skills.length.toLocaleString("fa-IR"),
          data.projects.length.toLocaleString("fa-IR"),
        )}. ${fa.skills.canvasKeys}`}
        className="block w-full touch-manipulation rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        style={{ height: `${CANVAS_HEIGHT}px` }}
      />
    </div>
  );
}
