"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { SectionPlaceholder } from "@/components/section";
import { fa } from "@/content/fa";
import type { GraphData } from "@/lib/db/projects";

import { PROJECT_NODE_COLOR } from "../lib/graph-theme";

/*
 * Full class strings, not interpolations: Tailwind generates utilities by
 * scanning source for literals, so `bg-category-${key.toLowerCase()}` would
 * silently produce nothing. Unknown categories fall back to muted.
 */
const CATEGORY_DOT_CLASSES: Record<string, string> = {
  LANGUAGE: "bg-category-language",
  FRONTEND: "bg-category-frontend",
  BACKEND: "bg-category-backend",
  DATABASE: "bg-category-database",
  DEVOPS: "bg-category-devops",
  TOOLING: "bg-category-tooling",
};

/*
 * The canvas (and therefore d3-force) loads only on the client, behind an
 * IntersectionObserver gate. Two separate decisions that must not be confused:
 *
 *  - `ssr: false` is required because the canvas reads layout sizes and opens a
 *    WebGL-free 2d context — both meaningless during prerender. It is also an
 *    error to call next/dynamic with ssr:false from a Server Component, which
 *    is why this wrapper exists as the thin client boundary the docs demand.
 *  - The observer gate is about bandwidth and CPU: d3-force plus the canvas
 *    code must not download or run until the section is actually approaching
 *    the viewport.
 */
const SkillsCanvas = dynamic(
  () => import("./skills-canvas").then((module) => module.SkillsCanvas),
  {
    ssr: false,
    loading: () => <GraphSkeleton />,
  },
);

function GraphSkeleton() {
  return (
    <div>
      <div
        aria-hidden
        className="bg-muted h-[440px] w-full animate-pulse rounded-xl"
      />
      <p className="sr-only">{fa.skills.loading}</p>
    </div>
  );
}

/**
 * Legend chips. HTML rather than canvas-drawn: they are real text, so they are
 * readable by assistive tech and selectable, at zero extra code.
 */
function Legend({ categories }: { categories: string[] }) {
  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      {categories.map((category) => (
        <li key={category} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`size-2.5 rounded-full ${CATEGORY_DOT_CLASSES[category] ?? "bg-muted"}`}
          />
          {/* Category names are enum keys (LANGUAGE, FRONTEND, …) — Latin
              identifiers, so they keep their own direction inside RTL text. */}
          <span dir="ltr" className="text-muted-foreground font-mono">
            {category}
          </span>
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{ backgroundColor: PROJECT_NODE_COLOR }}
        />
        <span className="text-muted-foreground">{fa.skills.legendProject}</span>
      </li>
    </ul>
  );
}

export function SkillsGraph({ data }: { data: GraphData }) {
  const [inView, setInView] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  // Null before mount; the animated graph is the default, the static one the
  // opt-out. A non-null assertion would lie about the loading state.
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    // Fires once: unobserve on first intersection, because there is nothing to
    // gain from tearing the graph down when it scrolls back out of view.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      // Start loading slightly before the section arrives, so the chunk is
      // ready by the time the user gets there.
      { rootMargin: "200px", threshold: 0 },
    );

    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  if (data.skills.length === 0 || data.projects.length === 0) {
    return <SectionPlaceholder note={fa.skills.empty} />;
  }

  const categories = [
    ...new Set(data.skills.map((skill) => skill.category)),
  ].sort();

  return (
    <div ref={anchorRef}>
      {inView ? (
        <>
          <SkillsCanvas
            data={data}
            dark={resolvedTheme === "dark"}
            staticLayout={prefersReducedMotion}
          />
          <Legend categories={categories} />
        </>
      ) : (
        // Reserves the layout space before the observer fires, so mounting the
        // graph does not shift the page (CLS). The pulse animation is CSS, so
        // the global reduced-motion rule already neutralises it.
        <GraphSkeleton />
      )}
    </div>
  );
}
