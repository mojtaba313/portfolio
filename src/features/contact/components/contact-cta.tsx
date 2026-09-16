"use client";

import { ArrowLeft } from "lucide-react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { Magnetic } from "./magnetic";

/**
 * Magnetic primary CTA for the finale.
 *
 * Activating scrolls to the form and focuses the message field: the CTA's UX
 * purpose is to start the conversation, not to navigate somewhere.
 */
export function ContactCta({ label }: { label: string }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const handleClick = (): void => {
    const field = document.getElementById("message");
    field?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "center",
    });
    // Focus after the scroll lands so the caret and the viewport arrive
    // together instead of fighting each other.
    window.setTimeout(
      () => field?.focus({ preventScroll: true }),
      prefersReducedMotion ? 0 : 450,
    );
  };

  return (
    <Magnetic strength={0.3}>
      <button
        type="button"
        onClick={handleClick}
        className="group bg-primary text-primary-foreground focus-visible:ring-ring relative inline-flex h-13 items-center gap-2.5 overflow-hidden rounded-full px-8 text-base font-semibold shadow-[0_0_36px_-8px_var(--primary)] transition-shadow duration-500 outline-none hover:shadow-[0_0_54px_-6px_var(--primary)] focus-visible:ring-2"
      >
        {/* Sheen sweep on hover: light answering the cursor, nothing more. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-l from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
        />
        <span className="relative">{label}</span>
        <ArrowLeft
          aria-hidden
          className="relative transition-transform duration-300 group-hover:-translate-x-1"
        />
      </button>
    </Magnetic>
  );
}
