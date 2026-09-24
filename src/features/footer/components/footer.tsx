import { fa, site } from "@/content/fa";

import { BackToTop } from "./back-to-top";
import { CopyrightYear } from "./copyright-year";

/**
 * Site footer: the page coming to rest.
 *
 * Quiet by design — a gradient hairline, the empty dock where the travelling
 * navbar comes to rest (see the settle controller in the navbar), and one
 * bottom row (credit, copyright, email, back-to-top). No sitemap, no legal,
 * and deliberately no link list: the navbar itself docks here, so a second
 * navigation would just duplicate it.
 *
 * Server component with one tiny client island (BackToTop). The dock and the
 * credit are found by attribute; if the animation chunk never loads, or the
 * visitor prefers reduced motion, the footer is simply this calm static
 * ending — the navbar stays in its sticky place and everything still works.
 *
 * The credit carries no entrance animation on purpose: it is the last line
 * of the page, and a trigger-gated reveal here once stayed stuck invisible
 * when the journey pin reshaped the document after triggers were measured.
 */
export function Footer() {
  const github = site.contact.github;
  const email = site.contact.email;

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

      {/* The only credit line in the footer. */}
      <p className="text-muted-foreground mt-4 text-center text-sm">
        {fa.footer.madeWith}{" "}
        <span aria-hidden className="text-primary">
          ♥
        </span>{" "}
        {fa.footer.by}{" "}
        {github ? (
          <a
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground focus-visible:ring-ring rounded-sm transition-colors outline-none hover:text-primary focus-visible:ring-2"
          >
            {site.name}
          </a>
        ) : (
          <span className="text-foreground">{site.name}</span>
        )}
      </p>

      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 pt-4 pb-12">
        <p className="text-muted-foreground/80 text-xs">
          <CopyrightYear />
          {email && (
            <>
              <span aria-hidden className="mx-2">
                •
              </span>
              <a
                href={`mailto:${email}`}
                dir="ltr"
                lang="en"
                className="focus-visible:ring-ring hover:text-foreground rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {email}
              </a>
            </>
          )}
        </p>
        <BackToTop />
      </div>
    </footer>
  );
}
