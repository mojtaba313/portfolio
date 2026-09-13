"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { fa, site } from "@/content/fa";
import { SECTION_IDS } from "@/lib/sections";
import { cn } from "@/lib/utils";

/**
 * Floating site navigation.
 *
 * Two states, one element, no layout jump: at the top it is transparent and
 * borderless, integrated into the hero; past a small scroll threshold the same
 * bar gains a blurred background, a hairline border and a pill radius. Only
 * background/border/radius/padding transition — width and position never
 * change, so there is nothing to jump.
 */

const LINKS = [
  { href: `#${SECTION_IDS.projects}`, label: fa.nav.projects },
  { href: `#${SECTION_IDS.skills}`, label: fa.nav.skills },
  { href: `#${SECTION_IDS.github}`, label: fa.nav.github },
  { href: `#${SECTION_IDS.contact}`, label: fa.nav.contact },
] as const;

/** Pixels scrolled before the bar becomes a floating pill. */
const SCROLL_THRESHOLD = 24;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    // Read once on mount too: a deep link or restored scroll position can
    // land the page already past the threshold.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /*
   * Active-section spy. A single observer watches all four anchors; the middle
   * band of the viewport decides, so exactly one link is active at a time and
   * the indicator does not flicker between neighbours.
   */
  useEffect(() => {
    const sections = LINKS.map(({ href }) => document.querySelector(href)).filter(
      (el): el is Element => el !== null,
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`);
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    // CSS entrance, not Motion: Motion renders different first-paint output
    // when reduced motion is on, which the server cannot predict — a hydration
    // mismatch for exactly the users the preference protects. See globals.css.
    <header className="animate-hero-nav fixed inset-x-0 top-0 z-40">
      {/*
       * The pill transition lives entirely in these classes: same box, same
       * width, only surface properties change, all of them transitioned.
       */}
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 transition-all duration-300",
          scrolled
            ? "bg-background/80 border-border/50 mt-3 border py-2 shadow-lg backdrop-blur-xl backdrop-saturate-150 [border-radius:999px]"
            : "border-transparent bg-transparent py-5",
        )}
      >
        {/* Brand: Persian name with a cyan status dot. Links home. */}
        <Link
          href="#main"
          className="focus-visible:ring-ring flex items-center gap-2 rounded-full focus-visible:ring-2 focus-visible:outline-none"
          aria-label={fa.nav.home}
        >
          <span
            aria-hidden
            className="bg-primary size-2 rounded-full shadow-[0_0_12px_var(--primary)]"
          />
          <span className="text-sm font-semibold tracking-tight">
            {site.name}
          </span>
        </Link>

        <nav aria-label={fa.nav.home} className="hidden items-center gap-1 md:flex">
          {LINKS.map(({ href, label }) => {
            const isActive = active === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "focus-visible:ring-ring relative rounded-full px-3.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                )}
              >
                {/* Active indicator: a single cyan dot, not an underline. */}
                <span
                  aria-hidden
                  className={cn(
                    // Physical centering (left + negative shift) so the dot
                    // stays centered regardless of document direction.
                    "bg-primary absolute top-1 left-1/2 size-1 -translate-x-1/2 rounded-full shadow-[0_0_8px_var(--primary)] transition-opacity",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
