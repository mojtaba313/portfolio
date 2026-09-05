import { SECTION_IDS } from "@/lib/sections";

import { jumpToSection } from "../lib/jump";
import { hasFlag } from "../lib/parse-input";
import type { Command } from "./types";

export const skillsCommand: Command = {
  name: "skills",
  usage: "skills --graph",
  description: "Scroll to the interactive skills graph.",
  run: (args, ctx) => {
    if (!hasFlag(args, "--graph")) {
      ctx.printMany([
        { kind: "error", text: "Missing flag." },
        { kind: "muted", text: "Usage: skills --graph" },
      ]);
      return;
    }

    jumpToSection(ctx, { id: SECTION_IDS.skills, label: "skills graph" });
  },
};
