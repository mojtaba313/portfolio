"use client";

import { AnimatePresence } from "motion/react";
import { Terminal } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { fa } from "@/content/fa";

import { BANNER_LINES } from "../commands/banner";
import { useTerminalStore } from "../store";
import { TerminalPanel } from "./terminal-panel";

/**
 * Mounts the terminal and owns its global keyboard shortcut.
 *
 * Rendered once from the site layout. Deliberately not lazy-loaded: the whole
 * feature is a few KB of local code with no heavy dependencies, and the
 * `Ctrl+\`` listener has to be live on first paint or the shortcut silently
 * does nothing until some other trigger pulls the chunk in.
 */
export function TerminalDock() {
  const isOpen = useTerminalStore((s) => s.isOpen);
  const seen = useTerminalStore((s) => s.seen);
  const toggle = useTerminalStore((s) => s.toggle);
  const close = useTerminalStore((s) => s.close);

  const launcherRef = useRef<HTMLButtonElement>(null);
  /** Set when the user closes the panel, so focus returns to where it came from. */
  const restoreFocusRef = useRef(false);

  /*
   * Opening greets first-timers with the banner — an empty black panel is
   * why nobody tries a second command. Runs in the event handler (never an
   * effect), and only when actually opening unseen.
   */
  const openPanel = useCallback(() => {
    const state = useTerminalStore.getState();
    if (!state.isOpen && !state.seen) {
      state.printMany(
        BANNER_LINES.map((text) => ({ kind: "output" as const, text })),
      );
    }
    toggle();
  }, [toggle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      /*
       * Matched on `event.code`, not `event.key`, and that is the whole reason
       * this works for the site's actual audience. `event.key` reports the
       * *character produced* by the layout: on a Persian keyboard the backquote
       * position does not produce a backtick, so `event.key === "\`"` would
       * never fire for a Persian-layout user. `event.code` reports the physical
       * key and is layout-independent.
       *
       * preventDefault matters too — some browsers and extensions bind Ctrl+`
       * themselves, and without it the panel opens and the browser also acts.
       *
       * Meta is accepted alongside Ctrl because Ctrl+` is taken by the OS on
       * macOS, where Cmd+` is the natural equivalent.
       */
      if (event.code === "Backquote" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        restoreFocusRef.current = useTerminalStore.getState().isOpen;
        openPanel();
        return;
      }

      if (event.key === "Escape" && useTerminalStore.getState().isOpen) {
        restoreFocusRef.current = true;
        close();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    /*
     * `isOpen` is read through `getState()` rather than taken from the render
     * scope so this listener is attached once for the lifetime of the page
     * instead of being torn down and re-added on every open and close.
     */
  }, [openPanel, close]);

  // Return focus to the launcher after a user-initiated close, so keyboard
  // users are not dumped back at the top of the document.
  useEffect(() => {
    if (!isOpen && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      launcherRef.current?.focus();
    }
  }, [isOpen]);

  const handleClose = () => {
    restoreFocusRef.current = true;
    close();
  };

  return (
    <>
      {!isOpen && (
        <Button
          ref={launcherRef}
          variant="outline"
          size="sm"
          onClick={() => openPanel()}
          title={fa.terminal.shortcutHint}
          aria-expanded={false}
          aria-keyshortcuts="Control+Backquote Meta+Backquote"
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] start-4 z-40 shadow-lg"
        >
          <span className="relative flex">
            <Terminal aria-hidden />
            {/* One-time nudge: a ping until the first open, then never again. */}
            {!seen && (
              <span
                aria-hidden
                className="bg-primary absolute -top-0.5 -end-0.5 flex size-2"
              >
                <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                <span className="bg-primary relative inline-flex size-2 rounded-full" />
              </span>
            )}
          </span>
          {fa.terminal.open}
          {/* Visible shortcut: a tooltip-only hint is never discovered. */}
          <kbd
            aria-hidden
            dir="ltr"
            className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]"
          >
            Ctrl + `
          </kbd>
        </Button>
      )}

      {/* AnimatePresence keeps the panel mounted through its exit transition, so
          the slide-out actually plays instead of the node vanishing. */}
      <AnimatePresence>
        {isOpen && <TerminalPanel onRequestClose={handleClose} />}
      </AnimatePresence>
    </>
  );
}
