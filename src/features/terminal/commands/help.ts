import type { Command } from "./types";

export const helpCommand: Command = {
  name: "help",
  description: "List every command.",
  run: (_args, ctx) => {
    /*
     * Left column is padded to the widest label so the descriptions line up.
     * Computed rather than hardcoded — a new command with a long usage string
     * shouldn't quietly break the alignment.
     */
    const labels = ctx.commands.map((c) => c.usage ?? c.name);
    const width = Math.max(...labels.map((l) => l.length));

    ctx.printMany([
      { kind: "output", text: "Available commands:" },
      { kind: "output", text: "" },
      ...ctx.commands.map((command, i) => ({
        kind: "output" as const,
        text: `  ${labels[i]!.padEnd(width)}  ${command.description}`,
      })),
      { kind: "output", text: "" },
      {
        kind: "muted",
        text: "Press Ctrl+` to toggle this panel, Esc to close it.",
      },
      {
        kind: "muted",
        text: "Use the up and down arrows to walk through past commands.",
      },
    ]);
  },
};
