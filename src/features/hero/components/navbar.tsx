"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

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
  const headerRef = useRef<HTMLElement>(null);
  /*
   * Settle journey (see the effect below): the header travels into the
   * footer dock and comes to rest as plain footer content. All three start
   * at the untouched header, so server HTML and first client render are
   * byte-identical — hydration cannot mismatch.
   */
  const [travelY, setTravelY] = useState(0);
  const [docked, setDocked] = useState(false);
  const [restTop, setRestTop] = useState<number | null>(null);

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

  /*
   * Settle: when the footer arrives, this same header travels down and comes
   * to rest inside the footer dock — no second navigation is ever rendered.
   *
   * Plain scroll math, deliberately GSAP-free: the journey pin and the reveal
   * system both drive ScrollTrigger, and the one fixed element that must
   * survive all of it is easier to reason about outside that machinery.
   * Document measurements are re-read on every update, so the landing stays
   * exact across pin-spacer release, canvas mounts and font swaps.
   *
   * Hydration safety comes from ownership: every write flows through React
   * state owned by this component, whose effects only run after its own
   * subtree has hydrated. Nothing outside ever touches this header, so a
   * reload with scroll restoration (e.g. sitting at the footer) renders the
   * resting state through React instead of mismatching against it.
   *
   * At rest the header becomes `position: absolute` in document coordinates —
   * it is footer content then, with no sticky nature left: overscroll carries
   * it with the footer and viewport resizes cannot detach it from the dock.
   * Reduced motion skips the listeners entirely: the bar simply stays sticky.
   */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const header = headerRef.current;
    const footer = document.querySelector<HTMLElement>("[data-footer]");
    const dock = document.querySelector<HTMLElement>("[data-footer-dock]");
    // The footer only exists on the home page; elsewhere there is no journey.
    if (!header || !footer || !dock) return;

    // The entrance holds its end keyframe with fill `both`, which outranks
    // inline styles — retire it now (end state is the natural state) so the
    // travel transform can take effect. Later renders carry the same
    // className string, so React leaves the DOM attribute alone.
    header.classList.remove("animate-hero-nav");

    // Past the midpoint the chrome is gone and the bar reads as docked.
    const DOCKED_AT = 0.55;
    const easeInOut = (t: number): number =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    let frame = 0;
    const update = (): void => {
      frame = 0;
      const vh = window.innerHeight;
      const scrollY = window.scrollY;
      const docH = document.documentElement.scrollHeight;
      // Too-short pages have no journey: the footer is already on screen.
      if (docH <= vh + 120) return;
      const footerTopDoc = footer.getBoundingClientRect().top + scrollY;
      const start = footerTopDoc - vh;
      const end = docH - vh;
      if (end <= start) return;
      const progress = Math.min(
        1,
        Math.max(0, (scrollY - start) / (end - start)),
      );
      const eased = easeInOut(progress);

      if (progress >= 0.999) {
        // At rest: absolute footer content, positioned so the visual frame
        // is continuous with the end of the travel.
        const dockRect = dock.getBoundingClientRect();
        const y = dockRect.top + dockRect.height / 2 - header.offsetHeight / 2;
        const top = Math.round((scrollY + y) * 10) / 10;
        setRestTop((prev) => (prev === top ? prev : top));
        setDocked((prev) => (prev ? prev : true));
        setTravelY((prev) => (prev === 0 ? prev : 0));
        return;
      }
      setRestTop((prev) => (prev === null ? prev : null));
      if (eased <= 0) {
        setTravelY((prev) => (prev === 0 ? prev : 0));
        setDocked((prev) => (!prev ? prev : false));
        return;
      }
      const dockRect = dock.getBoundingClientRect();
      const target =
        dockRect.top + dockRect.height / 2 - header.offsetHeight / 2;
      const y = Math.round(eased * target * 10) / 10;
      setTravelY((prev) => (prev === y ? prev : y));
      setDocked((prev) => {
        const next = progress > DOCKED_AT;
        return prev === next ? prev : next;
      });
    };
    // rAF gate: one measurement per frame no matter how chatty the source.
    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    // Resize/layout signals that move the footer without scrolling: the dock
    // and main boxes (canvas mounts, images, fonts), late assets, webfonts.
    const main = document.querySelector("main");
    const layoutObserver = new ResizeObserver(schedule);
    if (main) layoutObserver.observe(main);
    layoutObserver.observe(dock);
    const onLoad = (): void => schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("load", onLoad);
    if (document.fonts) {
      void document.fonts.ready.then(schedule);
    }
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      layoutObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  /*
   * One style object for the three resting/travelling states. `undefined`
   * renders no `style` attribute at all — the untouched header the server
   * sent. In rest mode the inline `position`/`top` override the `fixed`
   * utilities; `inset-x-0` keeps left/right, so the pill keeps its width.
   */
  const headerStyle: CSSProperties | undefined =
    restTop !== null
      ? { position: "absolute", top: restTop }
      : travelY !== 0
        ? { transform: `translate3d(0, ${travelY}px, 0)` }
        : undefined;

  return (
    // CSS entrance, not Motion: Motion renders different first-paint output
    // when reduced motion is on, which the server cannot predict — a hydration
    // mismatch for exactly the users the preference protects. See globals.css.
    //
    // `data-navbar` / `data-navbar-inner` are the settle contract (see the
    // effect below and globals.css): when the footer arrives, this same
    // header travels down into the footer dock. No visual effect on their own.
    <header
      ref={headerRef}
      data-navbar
      data-docked={docked ? "" : undefined}
      className="animate-hero-nav fixed inset-x-0 top-0 z-40"
      style={headerStyle}
    >
      {/*
       * The pill transition lives entirely in these classes: same box, same
       * width, only surface properties change, all of them transitioned.
       */}
      <div
        data-navbar-inner
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
