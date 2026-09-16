"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { SectionPlaceholder } from "@/components/section";
import { fa } from "@/content/fa";
import type { GraphData } from "@/lib/db/projects";
import { cn } from "@/lib/utils";

import { ConstellationDetails } from "./constellation-details";

/*
 * Full class strings, not interpolations: Tailwind generates utilities by
 * scanning source for literals, so `bg-category-${key}` would silently
 * produce nothing.
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
 * The canvas loads only on the client, behind an IntersectionObserver gate.
 * `ssr: false` is required (layout sizes, 2d context); the observer gate is
 * about bandwidth and CPU — the engine chunk must not download until the
 * section approaches the viewport.
 */
const ConstellationCanvas = dynamic(
  () =>
    import("./constellation-canvas").then(
      (module) => module.ConstellationCanvas,
    ),
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
        className="h-[460px] w-full animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
      />
      <p className="sr-only">{fa.skills.loading}</p>
    </div>
  );
}

export function SkillsGraph({ data }: { data: GraphData }) {
  const [inView, setInView] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const prefersReducedMotion = usePrefersReducedMotion();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0 },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  const linkCount = useMemo(
    () =>
      data.projects.reduce((sum, project) => sum + project.skills.length, 0),
    [data],
  );

  if (data.skills.length === 0) {
    return <SectionPlaceholder note={fa.skills.empty} />;
  }

  const categories = [
    ...new Set(data.skills.map((skill) => skill.category)),
  ].sort();
  // Hover previews; click pins. The panel follows whatever is live.
  const previewId = hoveredId ?? selectedId;

  return (
    <div ref={anchorRef}>
      {inView ? (
        <div className="space-y-4">
          <p data-numeric className="text-muted-foreground text-xs">
            {fa.skills.stats(
              data.skills.length.toLocaleString("fa-IR"),
              data.projects.length.toLocaleString("fa-IR"),
              linkCount.toLocaleString("fa-IR"),
            )}
          </p>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#050a14] shadow-[0_0_60px_-20px_rgba(34,211,238,0.35)]">
              <ConstellationCanvas
                data={data}
                dark={resolvedTheme !== "light"}
                staticLayout={prefersReducedMotion}
                selectedId={selectedId}
                hoveredId={hoveredId}
                categoryFilter={categoryFilter}
                onHover={setHoveredId}
                onSelect={setSelectedId}
              />
            </div>

            <aside className="flex min-h-52 flex-col gap-3 lg:min-h-full">
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label={fa.skills.legendSkill}
              >
                <FilterChip
                  active={categoryFilter === null}
                  onClick={() => setCategoryFilter(null)}
                >
                  {fa.skills.allCategories}
                </FilterChip>
                {categories.map((category) => (
                  <FilterChip
                    key={category}
                    active={categoryFilter === category}
                    onClick={() =>
                      setCategoryFilter(
                        categoryFilter === category ? null : category,
                      )
                    }
                    dotClass={CATEGORY_DOT_CLASSES[category]}
                  >
                    <span dir="ltr" className="font-mono">
                      {category}
                    </span>
                  </FilterChip>
                ))}
              </div>
              <div className="min-h-48 flex-1 lg:min-h-0">
                <ConstellationDetails
                  data={data}
                  activeId={previewId}
                  pinned={
                    selectedId !== null && hoveredId === null
                  }
                />
              </div>
            </aside>
          </div>

          <p className="text-muted-foreground text-xs">{fa.skills.hint}</p>

          <ul className="sr-only">
            {data.skills.map((skill) => (
              <li key={skill.id}>
                {skill.name}
                {(() => {
                  const titles = data.projects
                    .filter((project) =>
                      project.skills.some(
                        (edge) => edge.skillId === skill.id,
                      ),
                    )
                    .map((project) => project.title);
                  return titles.length > 0 ? `: ${titles.join("، ")}` : "";
                })()}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <GraphSkeleton />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  dotClass,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dotClass?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-cyan-300/40 bg-cyan-300/10 text-foreground"
          : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/25 hover:text-foreground",
      )}
    >
      {dotClass && (
        <span aria-hidden className={cn("size-2 rounded-full", dotClass)} />
      )}
      {children}
    </button>
  );
}
