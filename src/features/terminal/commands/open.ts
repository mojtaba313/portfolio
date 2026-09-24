import { SECTION_IDS } from "@/lib/sections";

import { jumpToSection } from "../lib/jump";
import type { Command } from "./types";

const TARGETS: Record<string, { id: string; label: string }> = {
  top: { id: "top", label: "top of the page" },
  projects: { id: SECTION_IDS.projects, label: "projects" },
  skills: { id: SECTION_IDS.skills, label: "skills graph" },
  contact: { id: SECTION_IDS.contact, label: "contact" },
  github: { id: SECTION_IDS.github, label: "GitHub stats" },
};

export const openCommand: Command = {
  name: "open",
  usage: "open <top|projects|skills|contact|github>",
  description: "Jump straight to a section of the page.",
  run: (args, ctx) => {
    const [target] = args.map((a) => a.toLowerCase());
    const dest = target ? TARGETS[target] : undefined;

    if (!dest) {
      ctx.printMany([
        { kind: "error", text: `Unknown destination: ${target ?? "(none)"}` },
        {
          kind: "muted",
          text: `Usage: open <${Object.keys(TARGETS).join("|")}>`,
        },
      ]);
      return;
    }

    jumpToSection(ctx, dest);
  },
};
