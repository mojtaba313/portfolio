import { cn } from "@/lib/utils";

/**
 * Wrapper for a home page section.
 *
 * The `id` is what the terminal's `skills --graph` and `github --stats` commands
 * scroll to, which is why it is required rather than optional — a section
 * without an anchor is unreachable from the terminal.
 *
 * `scroll-mt-*` offsets the scroll target so a jumped-to heading does not end up
 * flush against the top of the viewport.
 */
export function Section({
  id,
  title,
  subtitle,
  children,
  className,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      // tabIndex -1 lets scrollIntoView be followed by focus for screen reader
      // users without adding a tab stop for everyone else.
      tabIndex={-1}
      aria-labelledby={`${id}-heading`}
      className={cn("scroll-mt-8 py-14 focus:outline-none", className)}
    >
      {/*
       * Picked up by the GSAP scroll animations when that chunk loads. Inert
       * otherwise: without JavaScript the header simply renders as-is.
       */}
      <header data-reveal className="mb-6 space-y-1.5">
        <h2 id={`${id}-heading`} className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-muted-foreground max-w-prose text-sm">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  );
}

/**
 * Placeholder for a section whose feature lands in a later step.
 *
 * Exists so the anchors the terminal targets are real from now on: `skills
 * --graph` scrolls somewhere instead of reporting a missing section, and the
 * graph can be dropped in behind this without touching the command.
 */
export function SectionPlaceholder({ note }: { note: string }) {
  return (
    <div className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
      {note}
    </div>
  );
}
