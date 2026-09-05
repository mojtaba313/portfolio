import { SECTION_IDS } from "@/lib/sections";

import { jumpToSection } from "../lib/jump";
import { hasFlag } from "../lib/parse-input";
import type { Command } from "./types";

export const githubCommand: Command = {
  name: "github",
  usage: "github --stats",
  description: "Scroll to the GitHub activity stats.",
  run: (args, ctx) => {
    if (!hasFlag(args, "--stats")) {
      ctx.printMany([
        { kind: "error", text: "Missing flag." },
        { kind: "muted", text: "Usage: github --stats" },
      ]);
      return;
    }

    jumpToSection(ctx, { id: SECTION_IDS.github, label: "GitHub stats" });
  },
};
