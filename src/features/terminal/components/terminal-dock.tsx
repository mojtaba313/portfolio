"use client";

import { AnimatePresence } from "motion/react";
import { Terminal } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { fa } from "@/content/fa";

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
  const toggle = useTerminalStore((s) => s.toggle);
  const close = useTerminalStore((s) => s.close);

  const launcherRef = useRef<HTMLButtonElement>(null);
  /** Set when the user closes the panel, so focus returns to where it came from. */
  const restoreFocusRef = useRef(false);

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
        toggle();
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
  }, [toggle, close]);

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
          onClick={() => toggle()}
          title={fa.terminal.shortcutHint}
          className="fixed bottom-4 start-4 z-40 shadow-lg"
        >
          <Terminal aria-hidden />
          {fa.terminal.open}
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
