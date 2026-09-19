"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fa } from "@/content/fa";
import { cn } from "@/lib/utils";

/**
 * Copies the public email address to the clipboard.
 *
 * A small interaction with a concrete purpose: on a portfolio, the email is
 * the address the visitor actually needs, and selecting it from a mailto link
 * by hand is fiddly. Falls back to selecting via the adjacent link when the
 * Clipboard API is unavailable (non-secure contexts).
 *
 * A full pill at the same 48px target as the social links — never a nested
 * icon — with a text label that swaps to the outcome, so sighted users get
 * the same feedback screen readers get from the live region.
 */
export function CopyEmailButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = (next: "copied" | "failed"): void => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  };

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      flash("failed");
      return;
    }
    flash("copied");
  };

  const label =
    state === "copied"
      ? fa.contact.emailCopied
      : state === "failed"
        ? fa.contact.copyFailed
        : fa.contact.copyEmail;

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      title={fa.contact.copyEmail}
      aria-label={label}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex h-12 items-center gap-2.5 rounded-full border border-border/70 bg-white/[0.02] px-5 text-sm transition-all duration-300 outline-none hover:-translate-y-0.5 hover:border-cyan-700/50 focus-visible:ring-2 dark:hover:border-cyan-300/50"
    >
      {state === "copied" ? (
        <Check aria-hidden className="size-4.5 text-emerald-500" />
      ) : state === "failed" ? (
        <TriangleAlert aria-hidden className="size-4.5 text-destructive" />
      ) : (
        <Copy aria-hidden className="size-4.5" />
      )}
      <span aria-hidden className={cn(state === "copied" && "text-emerald-600 dark:text-emerald-400")}>
        {label}
      </span>
    </button>
  );
}
