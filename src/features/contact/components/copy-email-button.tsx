"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fa } from "@/content/fa";

/**
 * Copies the public email address to the clipboard.
 *
 * A small interaction with a concrete purpose: on a portfolio, the email is
 * the address the visitor actually needs, and selecting it from a mailto link
 * by hand is fiddly. Falls back to selecting via the adjacent link when the
 * Clipboard API is unavailable (non-secure contexts).
 */
export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      title={fa.contact.copyEmail}
      aria-label={copied ? fa.contact.emailCopied : fa.contact.copyEmail}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {copied ? (
        <Check aria-hidden className="size-4 text-emerald-400" />
      ) : (
        <Copy aria-hidden className="size-4" />
      )}
    </button>
  );
}
