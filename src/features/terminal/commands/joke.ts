import type { Command } from "./types";

/** Last resort: the terminal stays funny even if the database is down. */
const FALLBACK_JOKE =
  "Why do programmers prefer dark mode? Because light attracts bugs.";

export const jokeCommand: Command = {
  name: "joke",
  description: "A moment of levity, on the house.",
  run: async (_args, ctx) => {
    try {
      const response = await fetch("/api/jokes/random");
      if (response.ok) {
        const data: unknown = await response.json();
        if (
          typeof data === "object" &&
          data !== null &&
          "text" in data &&
          typeof (data as { text: unknown }).text === "string"
        ) {
          ctx.print({
            kind: "output",
            text: (data as { text: string }).text,
          });
          return;
        }
      }
    } catch {
      // Offline, restarting database, alien interference — fall through.
    }
    ctx.print({ kind: "output", text: FALLBACK_JOKE });
  },
};
