"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { fa } from "@/content/fa";

/**
 * Route error boundary for the whole site group.
 *
 * This exists because of a measured failure, not as boilerplate. With Postgres
 * unreachable, prerendered routes keep serving from the static shell — `/` and
 * every known project slug still return 200, which is the graceful degradation
 * the caching design was meant to buy. But the PPR path for an *unknown* slug
 * reads the database at request time, and without a boundary that request
 * returned a bare English "Internal Server Error" page: no RTL, no Persian, no
 * way back. On a Persian-only site that is the worst thing a visitor can see.
 *
 * Note the prop is `retry`, not `reset` — renamed in Next 16.
 */
export default function SiteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    /*
     * Server-side error details are stripped from the client payload in
     * production; only `digest` survives, which is the key for correlating this
     * with the server log. Logging it is what makes a production report
     * traceable. Swap this for a reporting service when one exists.
     */
    console.error("Route error", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-24">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {fa.common.errorTitle}
        </h1>
        <p className="text-muted-foreground max-w-prose">{fa.common.errorBody}</p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* `retry` re-renders the failed segment, which is the right first
              action for a transient database or network fault. */}
          <Button onClick={() => retry()}>
            <RotateCcw aria-hidden />
            {fa.common.retry}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">{fa.common.backHome}</Link>
          </Button>
        </div>

        {/*
         * The digest is the only server detail available to the client, and it
         * is what turns "it broke" into a searchable log line. Shown in an LTR
         * island because it is a Latin hex string inside Persian text.
         */}
        {error.digest && (
          <p
            dir="ltr"
            lang="en"
            className="ltr-island text-muted-foreground pt-4 text-xs"
          >
            error digest: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
