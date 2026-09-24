import { site } from "@/content/fa";
import { SECTION_IDS } from "@/lib/sections";

import { jumpToSection } from "../lib/jump";
import type { Command } from "./types";

export const contactCommand: Command = {
  name: "contact",
  description: "How to reach Mojtaba — then jumps there.",
  run: (_args, ctx) => {
    const { email, github, linkedin, telegram } = site.contact;
    const lines: { kind: "output" | "muted"; text: string }[] = [];

    if (email) lines.push({ kind: "output", text: `  email     ${email}` });
    if (github) lines.push({ kind: "output", text: `  github    ${github}` });
    if (linkedin) lines.push({ kind: "output", text: `  linkedin  ${linkedin}` });
    if (telegram) lines.push({ kind: "output", text: `  telegram  ${telegram}` });

    if (lines.length === 0) {
      ctx.print({
        kind: "muted",
        text: "No public channels configured — use the form below.",
      });
    } else {
      ctx.printMany([
        { kind: "output", text: "Reach Mojtaba:" },
        { kind: "output", text: "" },
        ...lines,
        { kind: "output", text: "" },
      ]);
    }

    jumpToSection(ctx, { id: SECTION_IDS.contact, label: "contact" });
  },
};
