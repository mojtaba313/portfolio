"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { fa } from "@/content/fa";
import {
  createJokeAction,
  deleteJokeAction,
  toggleJokeAction,
} from "@/features/admin/actions-jokes";
import {
  AdminField,
  AdminFormError,
  ADMIN_INPUT_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from "@/features/admin/components/ui";
import { AdminSubmitButton } from "@/features/admin/components/buttons";
import type { Joke } from "@/lib/db/jokes";
import { cn } from "@/lib/utils";

function CreateJokeForm() {
  const [state, formAction] = useActionState(createJokeAction, {});
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  /*
   * Success neither redirects nor re-renders by itself, so the client
   * refreshes the route (fresh list) and clears the form. DOM writes only —
   * no state — so this stays clear of the setState-in-effect rule.
   */
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
        <AdminField label="شناسه (slug)">
          <input
            name="slug"
            required
            dir="ltr"
            placeholder="dark-mode"
            className={`${ADMIN_INPUT_CLASS} font-mono`}
          />
        </AdminField>
        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked
              className="size-4 accent-cyan-400"
            />
            فعال
          </label>
        </div>
      </div>
      <AdminField label="متن لطیفه (انگلیسی)">
        <textarea
          name="text"
          required
          rows={2}
          dir="ltr"
          className={`${ADMIN_TEXTAREA_CLASS} font-mono text-sm`}
        />
      </AdminField>
      <AdminFormError message={state?.error} />
      <AdminSubmitButton label={fa.admin.create} />
    </form>
  );
}

/**
 * Jokes live on one page: the create form on top, the whole list below with
 * per-row active toggles and delete. Small table, no need for sub-routes.
 */
export function JokesManager({ jokes }: { jokes: Joke[] }) {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{fa.admin.new}</h2>
        <CreateJokeForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          {fa.admin.jokes} ({jokes.length.toLocaleString("fa-IR")})
        </h2>
        {jokes.length === 0 ? (
          <p className="text-muted-foreground text-sm">{fa.admin.emptyJokes}</p>
        ) : (
          <ul className="max-w-3xl space-y-2">
            {jokes.map((joke) => (
              <li
                key={joke.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-white/[0.02] px-4 py-3",
                  !joke.active && "opacity-50",
                )}
              >
                <p dir="ltr" className="min-w-0 flex-1 font-mono text-sm">
                  {joke.text}
                </p>
                <form action={toggleJokeAction.bind(null, joke.id)}>
                  <button
                    type="submit"
                    dir="ltr"
                    aria-pressed={joke.active}
                    title={joke.active ? fa.admin.read : fa.admin.unread}
                    className={cn(
                      "h-6 w-11 rounded-full p-0.5 transition-colors",
                      joke.active ? "bg-primary" : "bg-muted",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "block size-5 rounded-full bg-white transition-transform",
                        joke.active ? "translate-x-5" : "translate-x-0",
                      )}
                    />
                  </button>
                </form>
                <form action={deleteJokeAction.bind(null, joke.id)}>
                  <button
                    type="submit"
                    onClick={(event) => {
                      if (!window.confirm(fa.admin.confirmDelete))
                        event.preventDefault();
                    }}
                    className="text-destructive hover:bg-destructive/10 h-9 rounded-xl border border-destructive/30 px-4 text-sm transition-colors"
                  >
                    {fa.admin.delete}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
