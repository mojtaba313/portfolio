import type { Command } from "./types";

const VALID_THEMES = ["dark", "light"] as const;

type ValidTheme = (typeof VALID_THEMES)[number];

function isValidTheme(value: string): value is ValidTheme {
  return (VALID_THEMES as readonly string[]).includes(value);
}

export const themeCommand: Command = {
  name: "theme",
  usage: "theme [dark|light]",
  description: "Switch the site theme, or report the current one.",
  run: (args, ctx) => {
    const [requested] = args;

    // No argument: report rather than guess. Toggling here would make `theme`
    // ambiguous with an explicit `theme dark`.
    if (!requested) {
      ctx.printMany([
        { kind: "output", text: `Current theme: ${ctx.resolvedTheme ?? "unknown"}` },
        { kind: "muted", text: "Pass dark or light to change it." },
      ]);
      return;
    }

    const value = requested.toLowerCase();

    if (!isValidTheme(value)) {
      ctx.printMany([
        { kind: "error", text: `Unknown theme: ${requested}` },
        { kind: "muted", text: `Expected one of: ${VALID_THEMES.join(", ")}` },
      ]);
      return;
    }

    if (value === ctx.resolvedTheme) {
      ctx.print({ kind: "muted", text: `Theme is already ${value}.` });
      return;
    }

    /*
     * Goes straight to next-themes rather than through a mirrored copy in
     * Zustand, so this command and the header toggle drive the same state. See
     * the note in lib/store/ui-store.ts.
     */
    ctx.setTheme(value);
    ctx.print({ kind: "output", text: `Theme set to ${value}.` });
  },
};
