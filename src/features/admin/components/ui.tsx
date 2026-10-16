import Link from "next/link";

import { fa } from "@/content/fa";

/**
 * Shared admin form chrome: server components, no client JavaScript.
 *
 * One visual language across every entity page so the panel feels built,
 * not assembled — roomy dark inputs, Persian labels, primary submit.
 */

export const ADMIN_INPUT_CLASS =
  "border-border/70 bg-white/[0.03] focus:border-primary/60 h-11 w-full rounded-xl border px-4 text-sm outline-none";

export const ADMIN_TEXTAREA_CLASS =
  "border-border/70 bg-white/[0.03] focus:border-primary/60 min-h-28 w-full rounded-xl border px-4 py-3 text-sm leading-7 outline-none";

export function AdminPageHeader({
  title,
  backHref,
  action,
}: {
  title: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground rounded-full border border-border/70 px-3 py-1.5 text-sm transition-colors"
          >
            {fa.admin.back}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function AdminField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
    </label>
  );
}

export function AdminFormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}
