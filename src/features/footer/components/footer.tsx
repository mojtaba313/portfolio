import { fa, site } from "@/content/fa";

/**
 * Site footer: the page coming to rest.
 *
 * Deliberately near-empty — a gradient hairline parting the contact finale
 * from the quiet, an empty dock where the travelling navbar comes to rest
 * (see the settle controller in scroll-animations), and a single credit
 * line. Nothing else: no links, no labels, no CTA.
 *
 * Server component with zero client JavaScript of its own. The dock and the
 * credit are found by attribute; if the animation chunk never loads, or the
 * visitor prefers reduced motion, the footer is simply this calm static
 * ending — the navbar stays in its sticky place and everything still works.
 */
export function Footer() {
  const github = site.contact.github;

  return (
    <footer data-footer className="relative">
      {/* Parting from the contact finale: a hairline that fades out toward
          both edges, then air. No glow, no panel — just separation. */}
      <div
        aria-hidden
        className="bg-linear-to-l mx-auto h-px max-w-4xl from-transparent via-border to-transparent"
      />

      {/*
       * The navbar's resting place. Empty by design: it reserves exactly the
       * room the travelling header needs (plus breathing space) so the
       * arrival never covers the credit line below or jumps the layout —
       * the header is `fixed`, so it was never in the flow to begin with.
       */}
      <div
        data-footer-dock
        aria-hidden
        className="mx-auto flex min-h-44 w-full max-w-6xl items-center justify-center px-6"
      />

      {/* The only visible text in the footer. */}
      <p
        data-reveal
        className="text-muted-foreground pb-12 text-center text-sm"
      >
        {fa.footer.madeWith}{" "}
        <span aria-hidden className="text-primary">
          ♥
        </span>{" "}
        {fa.footer.by}{" "}
        {github ? (
          <a
            href={github}
            target="_blank"
            rel="noreferrer"
            className="text-foreground focus-visible:ring-ring rounded-sm transition-colors outline-none hover:text-primary focus-visible:ring-2"
          >
            {site.name}
          </a>
        ) : (
          <span className="text-foreground">{site.name}</span>
        )}
      </p>
    </footer>
  );
}
