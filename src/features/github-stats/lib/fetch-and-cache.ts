import { recordFailure, recordSuccess } from "@/lib/db/github-stats";

import {
  fetchContributions,
  fetchProfile,
  fetchRepos,
} from "./github-api";
import { CACHE_KEYS, type CacheKey } from "./schema";

/**
 * The scheduled refresh job.
 *
 * Deliberately separate from any route handler: it is invoked by
 * `scripts/refresh-github-stats.mts` under a systemd timer, not by an HTTP
 * request. Keeping the two apart means nothing about the job's schedule, retry
 * behaviour or runtime can be triggered by a visitor.
 */

/** Base interval between refreshes. Inside GitHub's limits by a wide margin. */
export const REFRESH_INTERVAL_MINUTES = 20;

/** Cap on how far backoff can push the next attempt. */
const MAX_BACKOFF_MINUTES = 6 * 60;

/**
 * Next attempt time, backing off exponentially after repeated failures.
 *
 * A key that keeps failing is usually failing for a reason that will not clear in
 * twenty minutes — a revoked token, a renamed account — so hammering the API on
 * the normal interval wastes rate limit that the healthy keys need. Capped so a
 * long outage still recovers on its own once the cause is fixed.
 */
function nextRefreshAt(failureCount: number): Date {
  const minutes =
    failureCount === 0
      ? REFRESH_INTERVAL_MINUTES
      : Math.min(
          MAX_BACKOFF_MINUTES,
          REFRESH_INTERVAL_MINUTES * 2 ** Math.min(failureCount, 5),
        );

  return new Date(Date.now() + minutes * 60_000);
}

export type RefreshOutcome = {
  key: CacheKey;
  status: "ok" | "failed";
  /** Failure reason, when status is "failed". */
  error?: string;
  durationMs: number;
};

export type RefreshReport = {
  username: string;
  outcomes: RefreshOutcome[];
  /** True when at least one key failed, so the caller can set an exit code. */
  hadFailures: boolean;
};

/**
 * Refreshes one cache key, converting a throw into a recorded failure.
 *
 * Each key is isolated on purpose. The contribution calendar needs a token while
 * the REST endpoints do not, so an unauthenticated deployment must still end up
 * with working stars and forks rather than an all-or-nothing failure.
 */
async function refreshKey(
  key: CacheKey,
  load: () => Promise<unknown>,
): Promise<RefreshOutcome> {
  const startedAt = Date.now();

  try {
    const payload = await load();
    await recordSuccess({
      key,
      // Prisma's Json input type does not accept `unknown`; the shape was
      // already validated by the fetcher's Zod parse.
      payload: payload as never,
      nextRefreshAt: nextRefreshAt(0),
    });
    return { key, status: "ok", durationMs: Date.now() - startedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    try {
      await recordFailure({
        key,
        error: message,
        // Backoff needs the *new* count; recordFailure increments what it reads,
        // so pass a nominal 1 and let repeated calls walk the interval up.
        nextRefreshAt: nextRefreshAt(1),
      });
    } catch (dbError) {
      // If Postgres is unreachable there is nowhere to record anything. Report
      // it rather than masking the original fault.
      console.error(`[github-stats] could not record failure for ${key}`, dbError);
    }

    return {
      key,
      status: "failed",
      error: message,
      durationMs: Date.now() - startedAt,
    };
  }
}

/**
 * Refreshes every cache key.
 *
 * Sequential rather than parallel: three concurrent requests would spend rate
 * limit faster with no benefit to a job that runs on a twenty-minute timer, and
 * serial execution keeps the log readable when one key fails.
 */
export async function refreshGithubStats(): Promise<RefreshReport> {
  const username = process.env.GITHUB_USERNAME;

  if (!username) {
    throw new Error(
      "GITHUB_USERNAME is not set — the refresh job has no account to read.",
    );
  }

  const outcomes: RefreshOutcome[] = [
    await refreshKey(CACHE_KEYS.profile, () => fetchProfile(username)),
    await refreshKey(CACHE_KEYS.repos, () => fetchRepos(username)),
    await refreshKey(CACHE_KEYS.contributions, () =>
      fetchContributions(username),
    ),
  ];

  return {
    username,
    outcomes,
    hadFailures: outcomes.some((outcome) => outcome.status === "failed"),
  };
}
