import type { TerminalLineInput } from "../store";

/**
 * A single terminal command.
 *
 * Commands are plain objects, deliberately: adding one means creating a file and
 * adding it to the registry array, with nothing else to touch. They receive
 * their arguments already tokenised and everything they are allowed to affect
 * through `ctx`, so a command never imports a store directly and stays trivial
 * to test in isolation.
 *
 * All user-facing text on a command — `description`, `usage`, and anything
 * printed through `ctx` — is **English**, regardless of the surrounding site
 * being Persian. The terminal is a deliberate LTR/English island.
 */
export type Command = {
  /** Invocation name. Lowercase, no spaces. */
  readonly name: string;
  /** One-line summary listed by `help`. */
  readonly description: string;
  /** Shown by `help` and when arguments don't parse. */
  readonly usage?: string;
  run(args: readonly string[], ctx: CommandContext): void | Promise<void>;
};

/**
 * Everything a command is allowed to reach.
 *
 * This is the seam that keeps commands decoupled from the app: the panel builds
 * the context from the stores and next-themes once, and commands only ever see
 * this interface.
 */
export type CommandContext = {
  /** Appends one output line. */
  print: (line: TerminalLineInput) => void;
  /** Appends several lines in a single store update, so the log renders once. */
  printMany: (lines: readonly TerminalLineInput[]) => void;
  /** Wipes the output log. */
  clear: () => void;

  /** The full registry, so `help` can list its peers without a circular import. */
  readonly commands: readonly Command[];

  /**
   * Resolved theme from next-themes — "dark" or "light", or undefined before
   * next-themes has read localStorage.
   */
  readonly resolvedTheme: string | undefined;
  setTheme: (theme: string) => void;

  readonly threeDEnabled: boolean;
  toggleThreeD: () => void;

  /**
   * Scrolls a section into view.
   *
   * Returns false when no element with that id is in the document, which is the
   * normal case for a feature that hasn't been built yet. Callers should report
   * that rather than pretending the jump worked.
   */
  scrollToSection: (id: string) => boolean;

  closeTerminal: () => void;
};
