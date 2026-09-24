import type { Command } from "./types";

/** Shared welcome art: the `banner` command and the first-open greeting. */
export const BANNER_LINES = [
  "  ╭─────────────────────────────╮",
  "  │      mojtaba.dev  ·  v1.0   │",
  "  ╰─────────────────────────────╯",
  "",
  "  Welcome, guest. This shell knows the whole site.",
  "  Type `help` — or just press buttons like a civilized person.",
] as const;

export const bannerCommand: Command = {
  name: "banner",
  description: "Show the welcome banner again.",
  run: (_args, ctx) => {
    ctx.printMany(BANNER_LINES.map((text) => ({ kind: "output" as const, text })));
  },
};
