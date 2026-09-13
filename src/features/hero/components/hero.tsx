import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fa, site } from "@/content/fa";
import { SECTION_IDS } from "@/lib/sections";

import { HeroVisual } from "./hero-visual";
import { MagneticButton } from "./magnetic-button";
import { Navbar } from "./navbar";

/**
 * Full-viewport hero: typography on the reading-start side, the interface
 * environment on the other.
 *
 * In RTL the DOM order below renders the text on the right and the visual on
 * the left — the correct mirror of the reference composition, with reading
 * order preserved. The asymmetry is intentional: text column slightly wider,
 * visual bleeding toward the viewport edge.
 *
 * A server component, deliberately: the entrance choreography is pure CSS
 * (see the animate-hero-* utilities in globals.css), so server HTML and first
 * paint are byte-identical and there is nothing to hydrate. The interactive
 * islands — navbar state, magnetic CTA, and the WebGL workspace visual (kept
 * out of SSR behind a dynamic import) — are client components mounted
 * inside it.
 */
export function Hero() {
  return (
    <>
      <Navbar />
      <section
        data-hero
        aria-labelledby="hero-heading"
        className="relative flex min-h-svh items-center overflow-clip bg-linear-to-b from-background from-90% sm:from-80% to-transparent px-6 pt-28 pb-32 sm:pt-32 lg:pt-24"
      >
        <div className="mx-auto grid w-full max-w-6xl items-center sm:gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          {/* Reading-start column: eyebrow, headline, support, CTAs. */}
          <div data-hero-content>
            <p
              className="animate-hero-fade mb-5 flex items-center gap-3"
              style={{ animationDelay: "0.15s" }}
            >
              <span
                aria-hidden
                className="bg-primary h-px w-8 shadow-[0_0_8px_var(--primary)]"
              />
              <span
                dir="ltr"
                lang="en"
                className="text-muted-foreground font-mono text-xs tracking-[0.25em]"
              >
                {fa.home.heroEyebrow}
              </span>
            </p>

            <h1
              id="hero-heading"
              className="text-4xl font-bold tracking-tight text-balance sm:text-5xl leading-[1.7]"
            >
              {fa.home.heroHeadline.map((line, i) => (
                // Mask: the line slides up from behind an overflow clip. The
                // bottom padding keeps Persian diacritics from clipping.
                <span key={line} className="block pb-1">
                  <span
                    className="animate-hero-line block"
                    style={{ animationDelay: `${0.25 + i * 0.12}s` }}
                  >
                    {i === fa.home.heroHeadline.length - 1 ? (
                      <span className="text-primary drop-shadow-[0_0_24px_var(--primary)] text-5xl sm:text-6xl pr-28">
                        {line}
                      </span>
                    ) : (
                      line
                    )}
                  </span>
                </span>
              ))}
            </h1>

            <div
              className="animate-hero-fade-up mt-6 space-y-3"
              style={{ animationDelay: "0.65s" }}
            >
              <p className="text-muted-foreground max-w-prose text-balance">
                {site.tagline}
              </p>
              <p
                dir="ltr"
                lang="en"
                className="text-muted-foreground/80 font-mono text-xs tracking-wider"
              >
                {fa.home.heroStack}
              </p>
            </div>

            <div
              className="animate-hero-fade-up mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "0.8s" }}
            >
              <MagneticButton>
                <Button size="lg" asChild>
                  <a href={`#${SECTION_IDS.projects}`} className="group">
                    {fa.home.heroCtaProjects}
                    {/* Forward in RTL points left; nudges further on hover. */}
                    <ArrowLeft
                      aria-hidden
                      className="transition-transform duration-300 group-hover:-translate-x-1"
                    />
                  </a>
                </Button>
              </MagneticButton>
              <Button size="lg" variant="outline" asChild>
                <a href={`#${SECTION_IDS.contact}`}>{fa.home.heroCtaContact}</a>
              </Button>
            </div>

            <p
              className="animate-hero-fade text-muted-foreground mt-6 text-xs"
              style={{ animationDelay: "1s" }}
            >
              {fa.home.heroTerminalHint}
            </p>
          </div>

          {/* Visual column: assembles after the type is underway. */}
          <div
            data-hero-visual
            className="animate-hero-visual"
            style={{ animationDelay: "0.3s" }}
          >
            <HeroVisual />
          </div>
        </div>

        {/* Scroll cue: a hairline with a travelling pulse, nothing more. */}
        <a
          href={`#${SECTION_IDS.projects}`}
          aria-label={fa.home.heroScroll}
          className="animate-hero-fade focus-visible:ring-ring absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 rounded-full focus-visible:ring-2 focus-visible:outline-none sm:flex"
          style={{ animationDelay: "1.3s" }}
        >
          <span className="text-muted-foreground text-[11px]">
            {fa.home.heroScroll}
          </span>
          <span className="bg-border relative block h-10 w-px overflow-hidden">
            <span className="bg-primary animate-hero-scroll absolute inset-x-0 top-0 h-1/2" />
          </span>
        </a>
      </section>
    </>
  );
}
