import { hasFlag } from "../lib/parse-input";
import type { Command } from "./types";

export const threeDCommand: Command = {
  name: "3d",
  usage: "3d --toggle",
  description: "Turn the ambient 3D background on or off.",
  run: (args, ctx) => {
    if (!hasFlag(args, "--toggle")) {
      ctx.printMany([
        {
          kind: "output",
          text: `3D background: ${ctx.threeDEnabled ? "on" : "off"}`,
        },
        { kind: "muted", text: "Pass --toggle to switch it." },
      ]);
      return;
    }

    ctx.toggleThreeD();

    /*
     * `ctx.threeDEnabled` is the value captured when this context was built, so
     * the post-toggle state is its negation. Reading the store again here would
     * be the obvious alternative, but it would couple the command to the store
     * and defeat the point of the context seam.
     */
    const next = !ctx.threeDEnabled;
    ctx.print({
      kind: "output",
      text: `3D background ${next ? "enabled" : "disabled"}.`,
    });

    // Honest about the current state of the build rather than implying the
    // toggle did something visible. Removed in step 8.
    ctx.print({
      kind: "muted",
      text: "Note: the scene itself is not implemented yet — this only sets the flag.",
    });
  },
};
