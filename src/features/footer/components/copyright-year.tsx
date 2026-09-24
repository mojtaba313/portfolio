"use client";

import { useSyncExternalStore } from "react";

/**
 * Copyright year, resolved on the client.
 *
 * `new Date()` is unstable across renders, so it cannot run during the
 * prerender — not even inside a Client Component. `useSyncExternalStore`
 * with a null server snapshot ships the shell without a year and fills it
 * in after hydration, with no `setState`-in-effect and nothing to mismatch
 * against.
 */

let cachedYear: string | null = null;

function getYear(): string {
  cachedYear ??= new Date()
    .getFullYear()
    .toLocaleString("fa-IR", { useGrouping: false });
  return cachedYear;
}

export function CopyrightYear() {
  const year = useSyncExternalStore(
    () => () => {},
    getYear,
    () => null,
  );
  return <span className="tabular-nums">©{year ? ` ${year}` : ""}</span>;
}
