import type { Command } from "./types";

export const hireCommand: Command = {
  name: "hire",
  description: "The elevator pitch. Thirty seconds, no buzzwords.",
  run: (_args, ctx) => {
    ctx.printMany([
      { kind: "output", text: "Why me?" },
      { kind: "output", text: "" },
      {
        kind: "output",
        text: "  • Whole thing: schema, API, UI. Works when I hand it over.",
      },
      {
        kind: "output",
        text: "  • I fix what everyone skips: focus rings, slow queries, empty states.",
      },
      {
        kind: "output",
        text: "  • READMEs that make your next hire productive on day one.",
      },
      { kind: "output", text: "" },
      {
        kind: "muted",
        text: "Reply within a day. Run `contact`.",
      },
    ]);
  },
};
