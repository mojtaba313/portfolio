/**
 * Splits a raw input line into a command name and its arguments.
 *
 * Quote-aware, so `echo "hello world"` yields two tokens rather than three. No
 * current command needs that, but a tokenizer that silently mangles quoted
 * input is a trap for whoever adds the next one.
 *
 * Deliberately not a real shell parser: no escapes, no globbing, no pipes, no
 * variable expansion. This is a command palette wearing a terminal costume, and
 * pretending otherwise would invite bug reports it can't honour.
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of input) {
    if (quote) {
      // Inside quotes everything is literal until the matching quote closes.
      if (char === quote) quote = null;
      else current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

export type ParsedInput = {
  /** Lowercased command name, or "" for an empty line. */
  name: string;
  args: string[];
};

export function parseInput(input: string): ParsedInput {
  const [name = "", ...args] = tokenize(input.trim());
  return { name: name.toLowerCase(), args };
}

/**
 * True when `args` contains the given long flag.
 *
 * Flags are matched exactly. `--graph` and `--graphs` are different flags, and
 * accepting prefixes would make typos silently succeed.
 */
export function hasFlag(args: readonly string[], flag: string): boolean {
  return args.includes(flag);
}
