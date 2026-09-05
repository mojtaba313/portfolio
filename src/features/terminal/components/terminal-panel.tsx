"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fa } from "@/content/fa";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

import { COMMANDS, findCommand, completeCommandName } from "../commands";
import type { CommandContext } from "../commands/types";
import { parseInput } from "../lib/parse-input";
import {
  clampTerminalHeight,
  TERMINAL_MAX_VIEWPORT_RATIO,
  TERMINAL_MIN_HEIGHT,
  useTerminalStore,
} from "../store";

/** Keyboard resize step, and the larger step when Shift is held. */
const RESIZE_STEP = 16;
const RESIZE_STEP_LARGE = 64;

type TerminalPanelProps = {
  /** Called when the panel asks to be dismissed, so the dock can restore focus. */
  onRequestClose: () => void;
};

export function TerminalPanel({ onRequestClose }: TerminalPanelProps) {
  const height = useTerminalStore((s) => s.height);
  const setHeight = useTerminalStore((s) => s.setHeight);
  const lines = useTerminalStore((s) => s.lines);
  const print = useTerminalStore((s) => s.print);
  const printMany = useTerminalStore((s) => s.printMany);
  const clear = useTerminalStore((s) => s.clear);
  const inputHistory = useTerminalStore((s) => s.inputHistory);
  const pushInputHistory = useTerminalStore((s) => s.pushInputHistory);

  const { resolvedTheme, setTheme } = useTheme();
  const threeDEnabled = useUiStore((s) => s.threeDEnabled);
  const toggleThreeD = useUiStore((s) => s.toggleThreeD);

  const prefersReducedMotion = useReducedMotion();

  const [draft, setDraft] = useState("");
  /** Index into `inputHistory`, or null while editing a fresh line. */
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* --------------------------------------------------------------------- *
   * Resize
   *
   * Hand-rolled pointer drag, no dependency. The important detail is that a
   * live drag writes straight to `element.style.height` and never touches the
   * store: at 60fps a store write would re-render every subscriber of every
   * selector in this component, which is exactly the re-render storm the
   * Zustand-over-Context decision was meant to avoid. The store only learns the
   * final height on pointerup.
   *
   * `setPointerCapture` keeps move and up events coming to the handle even once
   * the pointer has left it, which is what makes a 6px grab target usable.
   * --------------------------------------------------------------------- */
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel) return;
    // Stops the browser from starting a text selection or a scroll gesture.
    event.preventDefault();

    // Record the drag before attempting capture, not after: setPointerCapture
    // throws if the pointer is already captured elsewhere or the node is
    // detached, and an exception here would otherwise abandon the drag before
    // it started. Capture is an enhancement — it keeps events flowing once the
    // pointer leaves this 8px strip — so losing it should not lose the drag.
    dragRef.current = {
      startY: event.clientY,
      startHeight: panel.getBoundingClientRect().height,
    };

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* Capture unavailable; the drag still tracks while the pointer is over
         the handle, and pointerup/pointercancel still commit. */
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    // Docked to the bottom, so dragging up (a smaller clientY) grows the panel.
    const delta = drag.startY - event.clientY;
    const next = clampTerminalHeight(
      drag.startHeight + delta,
      window.innerHeight,
    );
    panel.style.height = `${next}px`;
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!dragRef.current || !panel) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // Commit once, so the persisted height survives a reload.
    setHeight(panel.getBoundingClientRect().height);
  };

  /**
   * Arrow-key resizing, so the handle is not mouse-only. This is the ARIA
   * window-splitter pattern: a focusable `separator` with value semantics.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? RESIZE_STEP_LARGE : RESIZE_STEP;
    const viewport = window.innerHeight;

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHeight(clampTerminalHeight(height + step, viewport));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setHeight(clampTerminalHeight(height - step, viewport));
    } else if (event.key === "Home") {
      event.preventDefault();
      setHeight(clampTerminalHeight(viewport, viewport));
    } else if (event.key === "End") {
      event.preventDefault();
      setHeight(TERMINAL_MIN_HEIGHT);
    }
  };

  /* --------------------------------------------------------------------- *
   * Command execution
   * --------------------------------------------------------------------- */

  const scrollToSection = (id: string): boolean => {
    const target = document.getElementById(id);
    if (!target) return false;
    target.scrollIntoView({
      // Smooth scrolling is animation, so it obeys the same preference as
      // everything else on the site.
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    return true;
  };

  const runInput = (raw: string) => {
    const trimmed = raw.trim();

    // Echo first, always — including a bare Enter, which a real shell also
    // answers with a fresh prompt line.
    print({ kind: "input", text: trimmed });
    if (!trimmed) return;

    pushInputHistory(trimmed);

    const { name, args } = parseInput(trimmed);
    const command = findCommand(name);

    if (!command) {
      printMany([
        { kind: "error", text: `command not found: ${name}` },
        { kind: "muted", text: "Type help to see what is available." },
      ]);
      return;
    }

    const context: CommandContext = {
      print,
      printMany,
      clear,
      commands: COMMANDS,
      resolvedTheme,
      setTheme,
      threeDEnabled,
      toggleThreeD,
      scrollToSection,
      closeTerminal: onRequestClose,
    };

    // `run` may be async; nothing here needs to wait on it, and floating the
    // promise would hide a rejection, so failures are reported explicitly.
    void Promise.resolve(command.run(args, context)).catch((error: unknown) => {
      print({
        kind: "error",
        text: `${name} failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    });
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runInput(draft);
      setDraft("");
      setHistoryCursor(null);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (inputHistory.length === 0) return;
      const next =
        historyCursor === null
          ? inputHistory.length - 1
          : Math.max(0, historyCursor - 1);
      setHistoryCursor(next);
      setDraft(inputHistory[next] ?? "");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyCursor === null) return;
      const next = historyCursor + 1;
      if (next >= inputHistory.length) {
        // Walked past the newest entry: back to an empty fresh line.
        setHistoryCursor(null);
        setDraft("");
        return;
      }
      setHistoryCursor(next);
      setDraft(inputHistory[next] ?? "");
      return;
    }

    if (event.key === "Tab") {
      // Tab completes rather than moving focus. The panel stays escapable via
      // Esc and the close button, so this does not trap keyboard users.
      event.preventDefault();
      const matches = completeCommandName(draft.trim());
      if (matches.length === 1) {
        setDraft(`${matches[0]} `);
      } else if (matches.length > 1) {
        printMany([
          { kind: "input", text: draft.trim() },
          { kind: "muted", text: matches.join("   ") },
        ]);
      }
    }
  };

  /* --------------------------------------------------------------------- *
   * DOM side effects. Both are writes to the DOM rather than to state, so
   * neither triggers the cascading-render problem that a setState-in-effect
   * would.
   * --------------------------------------------------------------------- */

  // Pin the log to the newest line as output arrives.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [lines]);

  // Opening the panel should put the caret in the prompt without a second click.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const maxHeight = Math.round(
    (typeof window === "undefined" ? 0 : window.innerHeight) *
      TERMINAL_MAX_VIEWPORT_RATIO,
  );

  return (
    /*
     * Two elements, one job each, and the split is not cosmetic.
     *
     * Motion takes ownership of the `style` attribute on any element it
     * animates and re-applies it every frame. When `height` lived on the
     * motion element, a live drag's direct `style.height` write was reverted on
     * Motion's next tick and the panel simply refused to resize. Keeping the
     * animation on the outer element and `height` on an inner one that Motion
     * never touches means the drag has uncontested ownership of the property.
     *
     * Animating `y` rather than `height` is also the cheaper transition — it
     * stays on the compositor instead of triggering layout every frame.
     */
    <motion.div
      className="fixed inset-x-0 bottom-0 z-40"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 420, damping: 38 }
      }
    >
      <div
        ref={panelRef}
        role="region"
        /* Persian label: this is chrome, and assistive tech should announce it
           in the document's language. The English island starts at the log. */
        aria-label={fa.terminal.title}
        className="bg-background/95 border-border relative flex flex-col border-t shadow-2xl backdrop-blur-sm"
        style={{ height: `${height}px` }}
      >
        {/* Resize handle */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={fa.terminal.resizeHandle}
          aria-valuenow={Math.round(height)}
          aria-valuemin={TERMINAL_MIN_HEIGHT}
          aria-valuemax={maxHeight || undefined}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={handleKeyDown}
          className="group focus-visible:ring-ring absolute inset-x-0 -top-1 z-10 flex h-2 cursor-ns-resize touch-none items-center justify-center focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="bg-border group-hover:bg-primary h-0.5 w-12 rounded-full transition-colors" />
        </div>

        {/* Persian chrome: title bar. Inherits the document's RTL direction. */}
        <div className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            {fa.terminal.title}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={fa.terminal.close}
            title={fa.terminal.close}
            onClick={onRequestClose}
          >
            <X aria-hidden />
          </Button>
        </div>

        {/*
         * The English LTR island starts here. `dir="ltr"` flips direction for this
         * subtree, `lang="en"` stops Persian digit shaping and font fallback, and
         * `ltr-island` supplies bidi isolation plus the Latin mono stack. All
         * three are needed; see the utility definition in globals.css.
         */}
        <div
          dir="ltr"
          lang="en"
          className="ltr-island flex min-h-0 flex-1 flex-col text-[13px]"
        >
          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-label="Terminal output"
            className="flex-1 overflow-y-auto px-3 py-2"
            tabIndex={0}
          >
            {lines.length === 0 ? (
              <p className="text-muted-foreground">
                Type <span className="text-primary">help</span> to get started.
              </p>
            ) : (
              lines.map((line) => (
                <div
                  key={line.id}
                  className={cn(
                    "whitespace-pre-wrap break-words",
                    line.kind === "error" && "text-destructive",
                    line.kind === "muted" && "text-muted-foreground",
                    line.kind === "output" && "text-foreground",
                    line.kind === "input" && "text-foreground",
                  )}
                >
                  {line.kind === "input" && (
                    <span className="text-primary select-none">$ </span>
                  )}
                  {line.text}
                </div>
              ))
            )}
          </div>

          {/* Prompt */}
          <div className="border-border flex shrink-0 items-center gap-2 border-t px-3 py-2">
            <span aria-hidden className="text-primary select-none">
              $
            </span>
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleInputKeyDown}
              aria-label="Terminal input"
              /* A shell prompt is not a place for the browser to helpfully
                 capitalise, autocorrect or offer past form values. */
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="placeholder:text-muted-foreground/60 min-w-0 flex-1 bg-transparent outline-none"
              placeholder="help"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
