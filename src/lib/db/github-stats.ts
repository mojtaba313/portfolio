import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import type { CacheKey } from "@/features/github-stats/lib/schema";

/**
 * Read and write access to the GitHub stats cache.
 *
 * The only module that touches the GithubStatsCache table. The job writes
 * through `recordSuccess`/`recordFailure`; the app reads through `getCacheRows`
 * and never calls GitHub.
 */

/** A cache row as the read path sees it, before payload validation. */
export type CacheRow = {
  key: string;
  payload: Prisma.JsonValue;
  fetchedAt: Date;
  lastError: string | null;
  failureCount: number;
};

/**
 * Reads every cache row in one query.
 *
 * One round trip rather than three: the panel renders all keys together, and
 * three sequential awaits would serialise three network hops for no benefit.
 */
export async function getCacheRows(): Promise<CacheRow[]> {
  return prisma.githubStatsCache.findMany({
    select: {
      key: true,
      payload: true,
      fetchedAt: true,
      lastError: true,
      failureCount: true,
    },
  });
}

/**
 * Stores a successful refresh.
 *
 * Clears `lastError` and resets `failureCount`, so a recovered key stops
 * reporting a stale problem.
 */
export async function recordSuccess(input: {
  key: CacheKey;
  payload: Prisma.InputJsonValue;
  nextRefreshAt: Date;
}): Promise<void> {
  const now = new Date();

  await prisma.githubStatsCache.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      payload: input.payload,
      fetchedAt: now,
      nextRefreshAt: input.nextRefreshAt,
      failureCount: 0,
    },
    update: {
      payload: input.payload,
      fetchedAt: now,
      nextRefreshAt: input.nextRefreshAt,
      lastError: null,
      failureCount: 0,
    },
  });
}

/**
 * Records a failed refresh **without touching `payload` or `fetchedAt`**.
 *
 * This is the whole point of the cache design: a failed fetch must not discard
 * the last good data. The UI keeps showing it along with its real age, and the
 * operator can see from `lastError` and `failureCount` that refreshes are
 * failing. A key that has never succeeded simply has no row, which the read path
 * treats as "not available yet" rather than as an error.
 */
export async function recordFailure(input: {
  key: CacheKey;
  error: string;
  nextRefreshAt: Date;
}): Promise<void> {
  const existing = await prisma.githubStatsCache.findUnique({
    where: { key: input.key },
    select: { failureCount: true },
  });

  if (!existing) {
    /*
     * No prior success, so there is nothing to preserve. The row is still
     * created — with an empty payload — so the failure is visible in the
     * database rather than leaving the operator guessing whether the job ever
     * ran. `fetchedAt` is epoch, which every staleness check reads as ancient.
     */
    await prisma.githubStatsCache.create({
      data: {
        key: input.key,
        payload: {},
        fetchedAt: new Date(0),
        nextRefreshAt: input.nextRefreshAt,
        lastError: input.error.slice(0, 1000),
        failureCount: 1,
      },
    });
    return;
  }

  await prisma.githubStatsCache.update({
    where: { key: input.key },
    data: {
      lastError: input.error.slice(0, 1000),
      failureCount: existing.failureCount + 1,
      nextRefreshAt: input.nextRefreshAt,
    },
  });
}
