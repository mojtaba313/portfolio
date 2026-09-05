import { clearCommand } from "./clear";
import { githubCommand } from "./github";
import { helpCommand } from "./help";
import { skillsCommand } from "./skills";
import { themeCommand } from "./theme";
import { threeDCommand } from "./three-d";
import type { Command } from "./types";

/**
 * The command registry.
 *
 * Order here is the order `help` prints, so it reads as a suggested path
 * through the site rather than alphabetically. Adding a command means writing
 * one file and adding one entry — nothing else in the terminal needs to know.
 */
export const COMMANDS: readonly Command[] = [
  helpCommand,
  skillsCommand,
  githubCommand,
  themeCommand,
  threeDCommand,
  clearCommand,
];

/** Case-insensitive lookup by name. */
export function findCommand(name: string): Command | undefined {
  const needle = name.toLowerCase();
  return COMMANDS.find((command) => command.name === needle);
}

/**
 * Names that start with the given prefix, for Tab completion.
 *
 * Returned in registry order so completion is deterministic.
 */
export function completeCommandName(prefix: string): string[] {
  const needle = prefix.toLowerCase();
  if (!needle) return COMMANDS.map((c) => c.name);
  return COMMANDS.filter((c) => c.name.startsWith(needle)).map((c) => c.name);
}

export type { Command, CommandContext } from "./types";
