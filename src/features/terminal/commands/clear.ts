import type { Command } from "./types";

export const clearCommand: Command = {
  name: "clear",
  description: "Clear the output above.",
  run: (_args, ctx) => {
    ctx.clear();
  },
};
