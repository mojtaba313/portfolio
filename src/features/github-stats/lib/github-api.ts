import {
  CONTRIBUTION_LEVELS,
  contributionsResponseSchema,
  profileResponseSchema,
  repoResponseSchema,
  type ContributionsCache,
  type ProfileCache,
  type ReposCache,
  type RepoSummary,
} from "./schema";

/**
 * GitHub API client for the scheduled job.
 *
 * Only ever called from the background job, never from a request path. The app
 * reads GitHub data exclusively from Postgres, so there is no client-facing rate
 * limit to hit and the site stays fast and correct even when GitHub is down.
 *
 * Every response is parsed with Zod before use: GitHub's payloads are large and
 * evolve, and a silently-missing field would otherwise reach the UI as
 * `undefined` and render as blank rather than as an error the job can report.
 */

const REST_BASE = "https://api.github.com";
const GRAPHQL_URL = "https://api.github.com/graphql";

/** How many repos to surface in each list. */
const TOP_REPOS = 6;
const RECENT_REPOS = 5;

/** Requests give up rather than hanging a systemd unit indefinitely. */
const REQUEST_TIMEOUT_MS = 15_000;

export class GithubApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GithubApiError";
  }
}

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    // Pinning the API version means a future default change on GitHub's side
    // cannot silently alter response shapes under us.
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "portfolio-stats-job",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { ...buildHeaders(), ...init?.headers },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    /*
     * 403 with a zero remaining count is a rate limit, not a permissions
     * problem. Distinguishing them matters because the operator's fix is
     * different: wait, versus fix the token.
     */
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (response.status === 403 && remaining === "0") {
      const reset = response.headers.get("x-ratelimit-reset");
      const resetAt = reset
        ? new Date(Number(reset) * 1000).toISOString()
        : "unknown";
      throw new GithubApiError(
        `GitHub rate limit exhausted; resets at ${resetAt}`,
        response.status,
      );
    }

    throw new GithubApiError(
      `GitHub responded ${response.status} for ${new URL(url).pathname}`,
      response.status,
    );
  }

  return response;
}

/** Fetches the user profile. */
export async function fetchProfile(username: string): Promise<ProfileCache> {
  const response = await request(`${REST_BASE}/users/${username}`);
  const parsed = profileResponseSchema.parse(await response.json());

  return {
    login: parsed.login,
    name: parsed.name,
    avatarUrl: parsed.avatar_url,
    profileUrl: parsed.html_url,
    publicRepos: parsed.public_repos,
    followers: parsed.followers,
    joinedAt: parsed.created_at,
  };
}

/**
 * Fetches repositories and reduces them to totals plus two short lists.
 *
 * Paginates because a profile can exceed the 100-per-page maximum, and stopping
 * at the first page would silently undercount stars.
 */
export async function fetchRepos(username: string): Promise<ReposCache> {
  const all: RepoSummary[] = [];
  let totalStars = 0;
  let totalForks = 0;

  // Hard page cap so a pathological account cannot make the job run forever.
  for (let page = 1; page <= 10; page++) {
    const response = await request(
      `${REST_BASE}/users/${username}/repos?per_page=100&page=${page}&sort=pushed`,
    );
    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const raw of batch) {
      const repo = repoResponseSchema.parse(raw);

      /*
       * Forks and archived repos are skipped. A forked repo's star count belongs
       * to whoever wrote it, and counting it would inflate the total into
       * something meaningless — the number is meant to say "people found my work
       * useful". Private repos cannot appear on an unauthenticated call but can
       * with a token, and they have no place on a public page.
       */
      if (repo.fork || repo.archived || repo.private) continue;

      totalStars += repo.stargazers_count;
      totalForks += repo.forks_count;

      all.push({
        name: repo.name,
        url: repo.html_url,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        pushedAt: repo.pushed_at,
      });
    }

    if (batch.length < 100) break;
  }

  const top = [...all].sort((a, b) => b.stars - a.stars).slice(0, TOP_REPOS);

  // Already sorted by pushed date from the API, but re-sorting keeps the list
  // correct regardless of how the pages interleaved.
  const recent = [...all]
    .sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""))
    .slice(0, RECENT_REPOS);

  return { totalStars, totalForks, countedRepos: all.length, top, recent };
}

/**
 * Fetches the contribution calendar via GraphQL.
 *
 * Requires GITHUB_TOKEN. GitHub exposes contribution counts only through
 * GraphQL, and GraphQL refuses unauthenticated requests even for public data —
 * there is no REST equivalent, so this is not an oversight that can be worked
 * around.
 */
export async function fetchContributions(
  username: string,
): Promise<ContributionsCache> {
  if (!process.env.GITHUB_TOKEN) {
    throw new GithubApiError(
      "GITHUB_TOKEN is required: the contribution calendar is GraphQL-only and GraphQL rejects anonymous requests",
    );
  }

  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  const response = await request(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login: username } }),
  });

  const parsed = contributionsResponseSchema.parse(await response.json());

  // GraphQL signals failure with HTTP 200 plus an errors array, so `request`'s
  // status check cannot catch this.
  if (parsed.errors?.length) {
    throw new GithubApiError(
      `GraphQL error: ${parsed.errors.map((e) => e.message).join("; ")}`,
    );
  }

  if (!parsed.data.user) {
    throw new GithubApiError(`GitHub user "${username}" not found`);
  }

  const calendar = parsed.data.user.contributionsCollection.contributionCalendar;

  // Flattened to a chronological day list; the UI regroups into columns, which
  // keeps the stored shape independent of how the grid happens to be laid out.
  const days = calendar.weeks.flatMap((week) =>
    week.contributionDays.map((day) => ({
      date: day.date,
      count: day.contributionCount,
      level: CONTRIBUTION_LEVELS[day.contributionLevel],
    })),
  );

  return { total: calendar.totalContributions, days };
}
