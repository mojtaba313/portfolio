"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { fa } from "@/content/fa";
import type { GraphData } from "@/lib/db/projects";

import { forceCenter } from "d3-force";

import {
  buildGraph,
  createSimulation,
  settleSimulation,
  type GraphLink,
  type GraphNode,
} from "../lib/force-layout";

/** Canvas height in CSS pixels. Width always follows the container. */
const CANVAS_HEIGHT = 440;

const LABEL_FONT = "12px Vazirmatn, Tahoma, sans-serif";

type Palette = {
  label: string;
  edge: string;
  edgeDim: string;
  ring: string;
};

const LIGHT: Palette = {
  label: "#171717",
  edge: "rgba(0, 0, 0, 0.22)",
  edgeDim: "rgba(0, 0, 0, 0.07)",
  ring: "#171717",
};

const DARK: Palette = {
  label: "#fafafa",
  edge: "rgba(255, 255, 255, 0.22)",
  edgeDim: "rgba(255, 255, 255, 0.07)",
  ring: "#fafafa",
};

/**
 * Interactive skills graph, rendered to canvas.
 *
 * Canvas rather than SVG: SVG is fine at low node counts, but every node and
 * edge here is a DOM element with its own layout cost, and the graph grows with
 * every project and skill added. Canvas keeps the cost flat regardless of size,
 * which is what makes this safe on mobile.
 *
 * Two responsibilities live here and are kept visibly apart: the d3 simulation
 * owns node positions, and the draw function owns pixels. The simulation never
 * touches the canvas and the draw function never touches the physics — they
 * meet only through the shared node array that d3 mutates in place.
 */
export function SkillsCanvas({
  data,
  dark,
  staticLayout,
}: {
  data: GraphData;
  dark: boolean;
  /**
   * When true the simulation is settled synchronously and drawn once, with no
   * animation loop. This is the `prefers-reduced-motion` path: the same final
   * arrangement, minus the motion that gets there.
   */
  staticLayout: boolean;
}) {
  const router = useRouter();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Interaction state lives in React (for the status line below the canvas)
  // with a ref mirror for the draw function, which runs inside d3's tick
  // callbacks and would otherwise close over stale values.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  /*
   * The draw function lives inside the simulation effect below, but
   * interaction handlers need to trigger repaints from outside it.
   */
  const drawRef = useRef<() => void>(() => {});
  const repaintRafRef = useRef(0);

  /*
   * d3 stops emitting ticks once the simulation settles, so the canvas keeps
   * its last painted frame. Without an explicit repaint, hover and selection
   * changes after that point update the status line but the highlight itself
   * freezes — the canvas never redraws. Every interaction therefore schedules
   * one repaint here. Coalesced through rAF because pointermove can fire
   * several times per frame and a full redraw per event would be wasteful.
   */
  const scheduleRepaint = () => {
    if (repaintRafRef.current) return;
    repaintRafRef.current = requestAnimationFrame(() => {
      repaintRafRef.current = 0;
      drawRef.current();
    });
  };

  useEffect(() => () => cancelAnimationFrame(repaintRafRef.current), []);

  const setHovered = (id: string | null) => {
    hoveredRef.current = id;
    setHoveredId(id);
    scheduleRepaint();
  };

  const setSelected = (id: string | null) => {
    selectedRef.current = id;
    setSelectedId(id);
    scheduleRepaint();
  };

  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const neighboursRef = useRef<Map<string, Set<string>>>(new Map());

  const palette = dark ? DARK : LIGHT;

  /**
   * Reverse index: skill id -> projects using it. Built from the projects'
   * edges rather than stored anywhere — the database only records the
   * project->skill direction, and the graph needs both.
   */
  const skillProjects = useMemo(() => {
    const map = new Map<string, { slug: string; title: string }[]>();
    for (const project of data.projects) {
      for (const edge of project.skills) {
        const list = map.get(edge.skillId) ?? [];
        list.push({ slug: project.slug, title: project.title });
        map.set(edge.skillId, list);
      }
    }
    return map;
  }, [data]);

  // The active node is whatever the highlight follows: hover wins while the
  // pointer is over a node, selection persists after it leaves.
  const activeId = hoveredId ?? selectedId;

  /*
   * Info-line content is derived from the `data` prop, never from nodesRef.
   * Reading a ref during render is both a lint error and a real bug — the ref
   * is empty on first render, so the line would lag a frame behind selection.
   * The draw function keeps using the ref; only this render-safe path is here.
   */
  const infoLine = (() => {
    if (!activeId) return null;

    if (activeId.startsWith("skill:")) {
      // Skill node ids embed the database id the project edges reference.
      const skillId = activeId.slice("skill:".length);
      const skill = data.skills.find((entry) => entry.id === skillId);
      if (!skill) return null;
      const projects = skillProjects.get(skillId) ?? [];
      if (projects.length === 0) return skill.name;
      return fa.skills.selectedSkill(
        skill.name,
        projects.length.toLocaleString("fa-IR"),
      );
    }

    const projectId = activeId.slice("project:".length);
    const project = data.projects.find((entry) => entry.id === projectId);
    if (!project) return null;
    return fa.skills.selectedProject(project.title);
  })();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { nodes, links } = buildGraph(data);
    nodesRef.current = nodes;
    linksRef.current = links;

    const neighbours = new Map<string, Set<string>>();
    for (const link of links) {
      const source = link.source as GraphNode;
      const target = link.target as GraphNode;
      if (!neighbours.get(source.id)) neighbours.set(source.id, new Set());
      if (!neighbours.get(target.id)) neighbours.set(target.id, new Set());
      neighbours.get(source.id)!.add(target.id);
      neighbours.get(target.id)!.add(source.id);
    }
    neighboursRef.current = neighbours;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, CANVAS_HEIGHT);

      const active = hoveredRef.current ?? selectedRef.current;
      const activeNeighbours = active
        ? (neighbours.get(active) ?? new Set<string>())
        : new Set<string>();

      const isLit = (node: GraphNode) =>
        !active || node.id === active || activeNeighbours.has(node.id);

      // Edges first, so nodes paint over the line ends.
      for (const link of links) {
        const source = link.source as GraphNode;
        const target = link.target as GraphNode;
        const lit =
          !active ||
          source.id === active ||
          target.id === active ||
          (activeNeighbours.has(source.id) &&
            activeNeighbours.has(target.id));
        ctx.strokeStyle = lit ? palette.edge : palette.edgeDim;
        ctx.lineWidth = lit ? 1.2 : 1;
        ctx.beginPath();
        ctx.moveTo(source.x ?? 0, source.y ?? 0);
        ctx.lineTo(target.x ?? 0, target.y ?? 0);
        ctx.stroke();
      }

      for (const node of nodes) {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const lit = isLit(node);

        ctx.globalAlpha = lit ? 1 : 0.25;
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(x, y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        if (node.id === active) {
          ctx.strokeStyle = palette.ring;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, node.radius + 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Project nodes are always labelled — there are only a few. Skill
        // labels appear on highlight only, or twenty-four names would fight
        // for the same pixels.
        const showLabel =
          node.kind === "project" ||
          node.id === active ||
          (active !== null && activeNeighbours.has(node.id));

        if (showLabel) {
          ctx.font = LABEL_FONT;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = palette.label;
          // Persian titles shape correctly on canvas; center alignment keeps
          // them symmetric under their node regardless of direction.
          ctx.fillText(node.label, x, y + node.radius + 5, 140);
        }

        ctx.globalAlpha = 1;
      }
    };

    // Published for scheduleRepaint: the effect owns the simulation, but
    // interaction handlers outside it need a way to ask for one fresh frame.
    drawRef.current = draw;

    const fitCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(CANVAS_HEIGHT * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${CANVAS_HEIGHT}px`;
    };

    fitCanvas();

    if (staticLayout) {
      // No animation loop at all: settle off-screen, so to speak, then paint
      // the result once. Resize re-settles rather than restarting motion.
      const simulation = createSimulation(
        nodes,
        links,
        container.clientWidth,
        CANVAS_HEIGHT,
      );
      settleSimulation(simulation);
      draw();

      const onResize = () => {
        fitCanvas();
        const resized = createSimulation(
          nodes,
          links,
          container.clientWidth,
          CANVAS_HEIGHT,
        );
        settleSimulation(resized);
        draw();
      };
      const observer = new ResizeObserver(onResize);
      observer.observe(container);
      return () => observer.disconnect();
    }

    const simulation = createSimulation(
      nodes,
      links,
      container.clientWidth,
      CANVAS_HEIGHT,
    );
    simulation.on("tick", draw);

    const onResize = () => {
      fitCanvas();
      // Recenter rather than rebuilding: the layout survives a resize instead
      // of collapsing and re-exploding.
      simulation.force(
        "center",
        forceCenter(container.clientWidth / 2, CANVAS_HEIGHT / 2),
      );
      simulation.alpha(0.25).restart();
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      simulation.stop();
    };
    // Rebuild when the theme flips so labels and edges follow it. Data changes
    // rebuild too, though in practice the data is cached for hours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dark, staticLayout]);

  const pickNode = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    let best: GraphNode | null = null;
    let bestDistance = Infinity;

    for (const node of nodesRef.current) {
      const distance = Math.hypot((node.x ?? 0) - x, (node.y ?? 0) - y);
      // Grab radius slightly larger than the painted one: nodes are small
      // targets, especially on touch.
      if (distance <= node.radius + 6 && distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }

    return best;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const node = pickNode(event);
    setHovered(node?.id ?? null);
    canvasRef.current!.style.cursor = node ? "pointer" : "default";
  };

  const handlePointerLeave = () => setHovered(null);

  const handleClick = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const node = pickNode(event);
    if (!node) {
      setSelected(null);
      return;
    }
    if (node.kind === "project" && node.url) {
      router.push(node.url);
      return;
    }
    // Tapping the selected skill again deselects it.
    setSelected(selectedRef.current === node.id ? null : node.id);
  };

  return (
    <div>
      <div ref={containerRef} className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={fa.skills.canvasLabel(
            data.skills.length.toLocaleString("fa-IR"),
            data.projects.length.toLocaleString("fa-IR"),
          )}
          onPointerMove={staticLayout ? undefined : handlePointerMove}
          onPointerLeave={staticLayout ? undefined : handlePointerLeave}
          onClick={staticLayout ? undefined : handleClick}
          className="block w-full touch-manipulation"
          style={{ height: `${CANVAS_HEIGHT}px` }}
        />
      </div>

      {/* Status line: fixed height reserves the space so selecting a node does
          not shift the layout below the graph. */}
      <p aria-live="polite" className="text-muted-foreground mt-3 min-h-6 text-sm">
        {infoLine ?? fa.skills.hint}
      </p>

      {/*
       * Screen-reader equivalent of the canvas. Three hundred individually
       * announced canvas regions would be unusable; a list of skills and the
       * projects each appears in carries the same information as text.
       */}
      <ul className="sr-only">
        {data.skills.map((skill) => {
          const projects = skillProjects.get(skill.id) ?? [];
          return (
            <li key={skill.id}>
              {skill.name}
              {projects.length > 0 && (
                <>: {projects.map((project) => project.title).join("، ")}</>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
