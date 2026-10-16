"use client";

import { useFormStatus } from "react-dom";

import { fa } from "@/content/fa";

/** Submit button with a pending state, for admin forms. */
export function AdminSubmitButton({ label }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground h-11 rounded-xl px-6 text-sm font-semibold transition-opacity disabled:opacity-60"
    >
      {label ?? fa.admin.save}
    </button>
  );
}

/**
 * Delete button with a native confirm gate. Renders inside a delete `<form>`:
 * the submit is cancelled unless the owner confirms. Plain `confirm()` is
 * deliberate — this is an owner tool, and a synchronous gate cannot be
 * dismissed by accident the way a custom popover can.
 */
export function AdminDeleteButton() {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(fa.admin.confirmDelete)) event.preventDefault();
      }}
      className="text-destructive hover:bg-destructive/10 h-11 rounded-xl border border-destructive/30 px-6 text-sm transition-colors"
    >
      {fa.admin.delete}
    </button>
  );
}
