import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Terminal panel state.
 *
 * Scoped to the terminal feature. Genuinely cross-feature toggles live in
 * `@/lib/store/ui-store`; theme lives in next-themes. See the comment there for
 * why the three are kept apart.
 */

/** Smallest useful panel: prompt line plus a couple of rows of output. */
export const TERMINAL_MIN_HEIGHT = 140;

/** Never let the panel swallow the whole viewport. */
export const TERMINAL_MAX_VIEWPORT_RATIO = 0.85;

export const TERMINAL_DEFAULT_HEIGHT = 320;

/** How many past inputs to keep for arrow-key recall. */
const MAX_INPUT_HISTORY = 100;

/**
 * Clamps a candidate height against the minimum and the current viewport.
 *
 * Lives here rather than in the store because the store must not touch
 * `window` — it is imported by modules that may be evaluated during SSR.
 */
export function clampTerminalHeight(px: number, viewportHeight: number): number {
  const max = Math.max(
    TERMINAL_MIN_HEIGHT,
    Math.round(viewportHeight * TERMINAL_MAX_VIEWPORT_RATIO),
  );
  return Math.min(max, Math.max(TERMINAL_MIN_HEIGHT, Math.round(px)));
}

export type TerminalLineKind =
  /** The echoed command the user typed, shown with a prompt marker. */
  | "input"
  /** Normal command output. */
  | "output"
  /** Command failed or was not recognised. */
  | "error"
  /** Secondary information — hints, notes, "not built yet" messages. */
  | "muted";

export type TerminalLine = {
  /** Monotonic id, used as the React key. Never reused within a session. */
  id: number;
  kind: TerminalLineKind;
  text: string;
};

/** A line before the store assigns it an id. */
export type TerminalLineInput = {
  kind: TerminalLineKind;
  text: string;
};

type TerminalState = {
  isOpen: boolean;
  /** Panel height in CSS pixels. The live drag does not write here — see the panel. */
  height: number;
  /** Rendered output, oldest first. */
  lines: TerminalLine[];
  /** Past inputs, oldest first, for arrow-key recall. */
  inputHistory: string[];
  nextLineId: number;

  open: () => void;
  close: () => void;
  toggle: () => void;
  setHeight: (px: number) => void;
  /** Appends one line. */
  print: (line: TerminalLineInput) => void;
  /** Appends several lines in one update, so the log renders once rather than N times. */
  printMany: (lines: readonly TerminalLineInput[]) => void;
  clear: () => void;
  pushInputHistory: (input: string) => void;
};

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      isOpen: false,
      height: TERMINAL_DEFAULT_HEIGHT,
      lines: [],
      inputHistory: [],
      nextLineId: 1,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),

      setHeight: (px) =>
        set({ height: Math.max(TERMINAL_MIN_HEIGHT, Math.round(px)) }),

      print: (line) =>
        set((s) => ({
          lines: [...s.lines, { ...line, id: s.nextLineId }],
          nextLineId: s.nextLineId + 1,
        })),

      printMany: (incoming) =>
        set((s) => ({
          lines: [
            ...s.lines,
            ...incoming.map((line, i) => ({ ...line, id: s.nextLineId + i })),
          ],
          nextLineId: s.nextLineId + incoming.length,
        })),

      clear: () => set({ lines: [] }),

      pushInputHistory: (input) =>
        set((s) => {
          // Collapse consecutive duplicates; repeating a command shouldn't
          // require two arrow-up presses to get past it.
          if (s.inputHistory.at(-1) === input) return s;
          const next = [...s.inputHistory, input];
          return {
            inputHistory:
              next.length > MAX_INPUT_HISTORY
                ? next.slice(next.length - MAX_INPUT_HISTORY)
                : next,
          };
        }),
    }),
    {
      name: "portfolio-terminal",
      /*
       * `isOpen` is deliberately not persisted, and that is a hydration
       * decision rather than a preference one: the panel is rendered from the
       * server layout, so if the open state came out of localStorage the first
       * client render would disagree with the server HTML. Starting closed
       * every time is both deterministic and the behaviour people expect.
       *
       * `height` and `inputHistory` are safe to persist because neither is read
       * during the first paint — height only matters once the panel is open,
       * and history only on an arrow-key press. `lines` are intentionally
       * session-scoped; restoring stale output would be confusing.
       */
      partialize: (s) => ({
        height: s.height,
        inputHistory: s.inputHistory,
      }),
    },
  ),
);
