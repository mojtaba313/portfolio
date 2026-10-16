import { getRandomJoke } from "@/lib/db/jokes";

/**
 * Random active joke for the terminal.
 *
 * Uncached by construction: the read goes straight to the database with no
 * `"use cache"`, so every call can draw a different joke. Tiny single-row
 * query, and the terminal keeps a hardcoded fallback for when the database
 * is unreachable, so this route failing never breaks the joke.
 */
export async function GET() {
  try {
    const joke = await getRandomJoke();
    if (!joke) return Response.json({ error: "empty" }, { status: 404 });
    return Response.json({ text: joke.text });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
