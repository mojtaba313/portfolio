import { GitFork, Star, Users } from "lucide-react";

import { SectionPlaceholder } from "@/components/section";
import { fa } from "@/content/fa";
import { formatNumber, formatRelativeTime } from "@/lib/format-number";

import { getGithubStats } from "../lib/read-cache";
import { ContributionHeatmap } from "./contribution-heatmap";

/**
 * GitHub stats panel.
 *
 * A server component reading Postgres only. GitHub is never contacted at request
 * time, so there is no rate limit exposed to visitors and the panel renders at
 * static-shell speed.
 *
 * Every state degrades rather than breaking, which is the requirement this
 * feature was specified around:
 *   - nothing cached yet  -> a quiet placeholder
 *   - some keys cached    -> render what exists, omit the rest
 *   - cache is old        -> render it anyway, with its real age and a note
 *   - database unreachable-> read-cache returns the empty state, page unaffected
 */
export async function GithubStats() {
  const stats = await getGithubStats();

  if (stats.isEmpty) {
    return <SectionPlaceholder note={fa.github.empty} />;
  }

  return (
    <div className="space-y-8">
      {/* Counters. Rendered from whichever keys are present, so a partially
          populated cache still produces a useful row. */}
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.repos && (
          <>
            <Stat
              icon={<Star aria-hidden className="size-4" />}
              label={fa.github.stars}
              value={stats.repos.totalStars}
            />
            <Stat
              icon={<GitFork aria-hidden className="size-4" />}
              label={fa.github.forks}
              value={stats.repos.totalForks}
            />
          </>
        )}
        {stats.profile && (
          <>
            <Stat
              label={fa.github.repos}
              value={stats.profile.publicRepos}
            />
            <Stat
              icon={<Users aria-hidden className="size-4" />}
              label={fa.github.followers}
              value={stats.profile.followers}
            />
          </>
        )}
      </dl>

      {stats.contributions && (
        <ContributionHeatmap
          days={stats.contributions.days}
          total={stats.contributions.total}
        />
      )}

      {stats.repos && stats.repos.top.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">{fa.github.topRepos}</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {stats.repos.top.map((repo) => (
              <li key={repo.name}>
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group border-border hover:border-primary/40 focus-visible:ring-ring flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {/* Repo names are Latin identifiers, so they get their own
                      direction to stop bidi reordering around dots and dashes. */}
                  <span dir="ltr" className="truncate font-mono text-xs">
                    {repo.name}
                  </span>
                  <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                    <Star aria-hidden className="size-3" />
                    {formatNumber(repo.stars)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
       * Freshness footer. The age is always shown, not only when stale: "updated
       * 8 minutes ago" is what tells the reader these numbers are live data
       * rather than something typed in by hand.
       */}
      {stats.lastUpdatedAt && (
        <footer className="text-muted-foreground space-y-1 text-xs">
          <p>
            <time dateTime={stats.lastUpdatedAt.toISOString()}>
              {fa.github.updatedAt(formatRelativeTime(stats.lastUpdatedAt))}
            </time>
          </p>
          {stats.isStale && <p>{fa.github.staleNote}</p>}
        </footer>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="border-border rounded-xl border p-4">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </dt>
      {/* data-numeric picks up the tabular-nums rule from globals.css, so a
          counter changing width does not nudge the layout. */}
      <dd data-numeric className="mt-1 text-2xl font-semibold">
        {formatNumber(value)}
      </dd>
    </div>
  );
}
