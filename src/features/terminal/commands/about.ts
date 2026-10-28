import type { Command } from "./types";

export const aboutCommand: Command = {
  name: "about",
  description: "Who is Mojtaba, in one screen.",
  run: (_args, ctx) => {
    ctx.printMany([
      { kind: "output", text: "Mojtaba — full-stack developer & medical student" },
      { kind: "output", text: "" },
      {
        kind: "output",
        text: "  stack    Next.js · React · TypeScript · Node.js",
      },
      { kind: "output", text: "  study    medicine, term 3" },
      { kind: "output", text: "  base     Urmia, Iran (UTC+3:30)" },
      { kind: "output", text: "  status   learning deep learning" },
      { kind: "output", text: "" },
      {
        kind: "muted",
        text: "Run `open projects` to see the proof, or `hire` for the pitch.",
      },
    ]);
  },
};
