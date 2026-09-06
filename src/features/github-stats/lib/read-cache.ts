import { getCacheRows } from "@/lib/db/github-stats";

import { REFRESH_INTERVAL_MINUTES } from "./fetch-and-cache";
import {
  CACHE_KEYS,
  contributionsCacheSchema,
  profileCacheSchema,
  reposCacheSchema,
  type ContributionsCache,
  type ProfileCache,
  type ReposCache,
} from "./schema";

/**
 * Read path for the GitHub stats panel.
 *
 * Reads Postgres only — never GitHub. Every payload is validated on the way out,
 * so a row written by an older version of the job is treated as unavailable
 * instead of rendering as blanks or crashing mid-render.
 */

/**
 * How far past the refresh interval a payload can drift before the UI says so.
 *
 * Three intervals rather than one: a single missed run is normal (a deploy, a
 * reboot, a slow GitHub response), and flagging that as stale would train the
 * reader to ignore the indicator. Three consecutive misses is a real signal.
 */
const STALE_AFTER_MINUTES = REFRESH_INTERVAL_MINUTES * 3;

export type GithubStats = {
  profile: ProfileCache | null;
  repos: ReposCache | null;
  contributions: ContributionsCache | null;
  /** Newest successful fetch across all keys, for the "updated X ago" label. */
  lastUpdatedAt: Date | null;
  /** True when the freshest payload is older than the staleness threshold. */
  isStale: boolean;
  /** True when nothing usable exists yet — the job has never run successfully. */
  isEmpty: boolean;
  /** Keys whose most recent refresh failed, for a quiet operator-facing hint. */
  failedKeys: string[];
};

/**
 * Loads and validates the cache.
 *
 * Returns a fully-formed object in every case, including "nothing cached yet".
 * Callers never have to handle a throw, which is what keeps a cold or broken
 * cache from taking down the page it appears on.
 */
export async function getGithubStats(): Promise<GithubStats> {
  let rows: Awaited<ReturnType<typeof getCacheRows>>;

  try {
    rows = await getCacheRows();
  } catch (error) {
    /*
     * The panel is one section of a page that is otherwise fully static. A
     * database fault here should cost the visitor this panel, not the page, so
     * it degrades to the empty state rather than propagating.
     */
    console.error("[github-stats] could not read cache", error);
    return {
      profile: null,
      repos: null,
      contributions: null,
      lastUpdatedAt: null,
      isStale: false,
      isEmpty: true,
      failedKeys: [],
    };
  }

  const byKey = new Map(rows.map((row) => [row.key, row]));

  /**
   * Validates one row's payload, discarding it if the shape no longer matches.
   *
   * Also collects the row's `fetchedAt`, but only for payloads that actually
   * parsed — the age label must describe data the visitor can see, not a row
   * that was rejected.
   */
  function read<T>(
    key: string,
    schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  ): { value: T | null; fetchedAt: Date | null } {
    const row = byKey.get(key);
    if (!row) return { value: null, fetchedAt: null };

    const parsed = schema.safeParse(row.payload);
    if (!parsed.success || parsed.data === undefined) {
      console.error(
        `[github-stats] cached payload for "${key}" does not match the current schema; ignoring it`,
      );
      return { value: null, fetchedAt: null };
    }

    return { value: parsed.data, fetchedAt: row.fetchedAt };
  }

  const profile = read(CACHE_KEYS.profile, profileCacheSchema);
  const repos = read(CACHE_KEYS.repos, reposCacheSchema);
  const contributions = read(CACHE_KEYS.contributions, contributionsCacheSchema);

  const timestamps = [profile, repos, contributions]
    .map((entry) => entry.fetchedAt)
    .filter((value): value is Date => value !== null);

  const lastUpdatedAt =
    timestamps.length > 0
      ? new Date(Math.max(...timestamps.map((date) => date.getTime())))
      : null;

  const isEmpty =
    profile.value === null &&
    repos.value === null &&
    contributions.value === null;

  const isStale =
    lastUpdatedAt !== null &&
    Date.now() - lastUpdatedAt.getTime() > STALE_AFTER_MINUTES * 60_000;

  const failedKeys = rows
    .filter((row) => row.lastError !== null)
    .map((row) => row.key);

  return {
    profile: profile.value,
    repos: repos.value,
    contributions: contributions.value,
    lastUpdatedAt,
    isStale,
    isEmpty,
    failedKeys,
  };
}
