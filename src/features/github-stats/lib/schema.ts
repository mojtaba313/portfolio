import { z } from "zod";

/**
 * Shapes of the cached GitHub payloads.
 *
 * These live in TypeScript rather than in Postgres columns, which is the reason
 * `GithubStatsCache.payload` is a Json column: each cache key holds a different
 * shape, and GitHub's responses evolve. Validating on read means a payload
 * written by an older version of the job is rejected as unusable rather than
 * crashing a server component halfway through rendering, and changing a shape
 * costs a code deploy instead of a migration.
 *
 * Two layers of schema here, deliberately:
 *   - `*ResponseSchema` validates what GitHub sent, so a change on their side
 *     surfaces at the fetch boundary with a clear error.
 *   - `*CacheSchema` validates what we stored, so a stale or corrupt row cannot
 *     reach the UI.
 * They differ because the job reduces GitHub's verbose responses down to only
 * the fields the page renders.
 */

/** The three cache slots. A closed set, not free-form keys. */
export const CACHE_KEYS = {
  profile: "profile",
  repos: "repos",
  contributions: "contributions",
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** GitHub REST: GET /users/{username} — only the fields we keep. */
export const profileResponseSchema = z.object({
  login: z.string(),
  name: z.string().nullable(),
  avatar_url: z.string(),
  html_url: z.string(),
  bio: z.string().nullable(),
  public_repos: z.number().int(),
  followers: z.number().int(),
  following: z.number().int(),
  created_at: z.string(),
});

export const profileCacheSchema = z.object({
  login: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string(),
  profileUrl: z.string(),
  publicRepos: z.number().int(),
  followers: z.number().int(),
  /** ISO string: JSON has no Date type, so the boundary is explicit. */
  joinedAt: z.string(),
});

export type ProfileCache = z.infer<typeof profileCacheSchema>;

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

/** GitHub REST: GET /users/{username}/repos */
export const repoResponseSchema = z.object({
  name: z.string(),
  full_name: z.string(),
  html_url: z.string(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stargazers_count: z.number().int(),
  forks_count: z.number().int(),
  pushed_at: z.string().nullable(),
  fork: z.boolean(),
  archived: z.boolean(),
  private: z.boolean(),
});

const repoSummarySchema = z.object({
  name: z.string(),
  url: z.string(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stars: z.number().int(),
  forks: z.number().int(),
  pushedAt: z.string().nullable(),
});

export const reposCacheSchema = z.object({
  /** Aggregates across every counted repo, not just the top few shown. */
  totalStars: z.number().int(),
  totalForks: z.number().int(),
  /** How many repos the totals were computed from. */
  countedRepos: z.number().int(),
  /** Highest-starred repos, already sorted and truncated by the job. */
  top: z.array(repoSummarySchema),
  /** Most recently pushed repos, for the "recent activity" panel. */
  recent: z.array(repoSummarySchema),
});

export type ReposCache = z.infer<typeof reposCacheSchema>;
export type RepoSummary = z.infer<typeof repoSummarySchema>;

// ---------------------------------------------------------------------------
// Contributions (commit heatmap)
// ---------------------------------------------------------------------------

/**
 * GitHub GraphQL: user.contributionsCollection.contributionCalendar.
 *
 * Only reachable with a token — GitHub exposes contribution counts through
 * GraphQL only, and GraphQL rejects unauthenticated requests even for public
 * data. Its absence is handled as a per-key failure so the rest of the panel
 * still renders.
 */
export const contributionsResponseSchema = z.object({
  data: z.object({
    user: z
      .object({
        contributionsCollection: z.object({
          contributionCalendar: z.object({
            totalContributions: z.number().int(),
            weeks: z.array(
              z.object({
                contributionDays: z.array(
                  z.object({
                    date: z.string(),
                    contributionCount: z.number().int(),
                    /** 0–4 bucket GitHub already computed for us. */
                    contributionLevel: z.enum([
                      "NONE",
                      "FIRST_QUARTILE",
                      "SECOND_QUARTILE",
                      "THIRD_QUARTILE",
                      "FOURTH_QUARTILE",
                    ]),
                  }),
                ),
              }),
            ),
          }),
        }),
      })
      .nullable(),
  }),
  // GraphQL returns 200 with an errors array rather than an HTTP error status,
  // so this has to be inspected explicitly.
  errors: z
    .array(z.object({ message: z.string() }))
    .optional(),
});

export const contributionDaySchema = z.object({
  date: z.string(),
  count: z.number().int(),
  /** 0 = none, 4 = busiest. Flattened from GitHub's enum. */
  level: z.number().int().min(0).max(4),
});

export const contributionsCacheSchema = z.object({
  total: z.number().int(),
  /** Flat, chronological list. The UI regroups into weeks for the grid. */
  days: z.array(contributionDaySchema),
});

export type ContributionsCache = z.infer<typeof contributionsCacheSchema>;
export type ContributionDay = z.infer<typeof contributionDaySchema>;

/** Maps GitHub's level enum onto the 0–4 scale stored in the cache. */
export const CONTRIBUTION_LEVELS = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
} as const;

/** Payload schema for each cache key, so the read path can pick by key. */
export const CACHE_SCHEMAS = {
  profile: profileCacheSchema,
  repos: reposCacheSchema,
  contributions: contributionsCacheSchema,
} as const;
