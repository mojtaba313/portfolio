"use client";

/**
 * Desktop rail: counter plus one jump button per project.
 *
 * Clicking a button dispatches `portfolio:project-jump`, which the GSAP
 * animator (when loaded) translates into the matching scroll position — the
 * scrubbed playhead then carries the stage there. Without JS, or before the
 * animator chunk arrives, the buttons are inert but harmless: the stage still
 * shows the first project statically.
 */
export function ProjectRail({
  projects,
  total,
  currentLabel,
  counterSeparator,
}: {
  projects: { slug: string; title: string }[];
  total: string;
  currentLabel: string;
  counterSeparator: string;
}) {
  const jump = (index: number) => {
    window.dispatchEvent(
      new CustomEvent<number>("portfolio:project-jump", { detail: index }),
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="font-mono text-sm" dir="ltr">
        <span data-project-current className="text-primary">
          {currentLabel}
        </span>
        <span className="text-muted-foreground mx-2">{counterSeparator}</span>
        <span className="text-muted-foreground">{total}</span>
      </div>

      <div
        role="list"
        aria-label={currentLabel}
        className="relative flex min-w-0 flex-col justify-center gap-4 py-1"
      >
        <div className="bg-border/50 absolute inset-y-0 start-[5px] w-px" />
        {projects.map((project, index) => (
          <div key={project.slug} role="listitem" className="min-w-0">
            <button
              type="button"
              data-project-dot
              data-active={index === 0}
              onClick={() => jump(index)}
              aria-label={`${project.title}`}
              title={project.title}
              className="group focus-visible:ring-ring relative z-10 flex w-full min-w-0 items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:outline-none"
            >
              <span
                aria-hidden
                data-project-dot-mark
                className="border-background group-data-[active=true]:bg-primary group-data-[active=true]:shadow-[0_0_14px_var(--primary)] bg-muted-foreground/40 size-2.5 shrink-0 rounded-full border transition-colors"
              />
              <span
                dir="auto"
                className="text-muted-foreground group-hover:text-foreground group-data-[active=true]:text-foreground min-w-0 flex-1 truncate text-left text-[11px] transition-colors"
              >
                {project.title}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
