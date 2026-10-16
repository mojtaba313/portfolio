import { prisma } from "./prisma";

/**
 * Terminal jokes.
 *
 * Reads go through here rather than through `prisma` directly, matching the
 * repository convention in this directory. Admin writes live in the admin
 * actions, next to their validation — this module owns the public reads.
 */

export type Joke = {
  id: string;
  slug: string;
  text: string;
  active: boolean;
};

/** One random active joke, or null when the table is empty. */
export async function getRandomJoke(): Promise<Joke | null> {
  const count = await prisma.joke.count({ where: { active: true } });
  if (count === 0) return null;
  const [joke] = await prisma.joke.findMany({
    where: { active: true },
    select: { id: true, slug: true, text: true, active: true },
    skip: Math.floor(Math.random() * count),
    take: 1,
  });
  return joke ?? null;
}

/** Every joke, newest first — the admin list. */
export async function listJokes(): Promise<Joke[]> {
  return prisma.joke.findMany({
    select: { id: true, slug: true, text: true, active: true },
    orderBy: { createdAt: "desc" },
  });
}
