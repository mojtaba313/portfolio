"use client";

import { useActionState } from "react";

import { fa } from "@/content/fa";
import { loginAction } from "@/features/admin/actions";

/**
 * Owner login form. Wrong passwords and missing configuration both come back
 * as plain error strings from the action — nothing about the gate leaks
 * beyond "no".
 */
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          {fa.admin.loginPassword}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
          className="border-border/70 bg-white/[0.03] focus:border-primary/60 h-12 w-full rounded-xl border px-4 font-mono outline-none"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground h-12 w-full rounded-xl font-semibold transition-opacity disabled:opacity-60"
      >
        {fa.admin.loginSubmit}
      </button>
    </form>
  );
}
