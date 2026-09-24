"use client";

import { ArrowUp } from "lucide-react";

import { fa } from "@/content/fa";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/**
 * Back-to-top button for the footer.
 *
 * A plain button rather than an anchor: there is no `#top` focus target to
 * move to, this only scrolls. Smooth scrolling obeys reduced motion like
 * every other animated scroll on the site.
 */
export function BackToTop() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <button
      type="button"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        })
      }
      aria-label={fa.footer.backToTop}
      title={fa.footer.backToTop}
      className="focus-visible:ring-ring text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-full border border-transparent transition-colors hover:border-border/70 focus-visible:ring-2 focus-visible:outline-none"
    >
      <ArrowUp aria-hidden className="size-4" />
    </button>
  );
}
