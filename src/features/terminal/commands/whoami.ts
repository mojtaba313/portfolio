import type { Command } from "./types";

export const whoamiCommand: Command = {
  name: "whoami",
  description: "Find out who you are around here.",
  run: (_args, ctx) => {
    ctx.printMany([
      { kind: "output", text: "guest" },
      {
        kind: "muted",
        text: "…but the interesting person here is mojtaba. Try `about`.",
      },
    ]);
  },
};
