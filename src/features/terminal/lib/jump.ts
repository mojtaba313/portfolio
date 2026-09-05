import type { CommandContext } from "../commands/types";

/**
 * Shared implementation for the commands that navigate to a page section.
 *
 * Both `skills --graph` and `github --stats` target sections that land in later
 * steps, so the not-yet-built path has to be a first-class outcome rather than a
 * silent failure. Keeping it here means the two commands cannot drift into
 * reporting the same situation differently.
 */
export function jumpToSection(
  ctx: CommandContext,
  options: {
    /** Element id to scroll to. */
    id: string;
    /** Human-readable name for messages, e.g. "skills graph". */
    label: string;
  },
): void {
  const found = ctx.scrollToSection(options.id);

  if (!found) {
    ctx.printMany([
      { kind: "error", text: `No ${options.label} on this page yet.` },
      {
        kind: "muted",
        text: `Expected an element with id "${options.id}" — it arrives in a later build.`,
      },
    ]);
    return;
  }

  ctx.print({ kind: "output", text: `Jumping to the ${options.label}…` });
}
