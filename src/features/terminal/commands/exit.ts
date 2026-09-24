import type { Command } from "./types";

/**
 * Closes the panel. `quit` is registered alongside — muscle memory from
 * half a dozen tools spells it differently, and a terminal that argues
 * about spelling is a terminal nobody likes.
 */
function makeExit(name: string): Command {
  return {
    name,
    description: name === "exit" ? "Close this terminal." : "Same as exit.",
    run: (_args, ctx) => {
      ctx.closeTerminal();
    },
  };
}

export const exitCommand = makeExit("exit");
export const quitCommand: Command = { ...makeExit("quit"), hidden: true };
