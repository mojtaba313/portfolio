import type { Command } from "./types";

export const echoCommand: Command = {
  name: "echo",
  usage: "echo <text>",
  description: "Say it back. Quotes respected, obviously.",
  run: (args, ctx) => {
    if (args.length === 0) {
      ctx.print({ kind: "output", text: "" });
      return;
    }
    ctx.print({ kind: "output", text: args.join(" ") });
  },
};
