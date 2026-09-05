"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { fa } from "@/content/fa";

/**
 * Light/dark toggle.
 *
 * Deliberately a two-state light↔dark switch rather than a three-way cycle
 * through "system": the terminal exposes `theme dark|light` and the two
 * controls should not disagree about what states exist. `enableSystem` is still
 * on in the provider, so the OS preference decides the *initial* theme — this
 * button just takes over once the user expresses an opinion.
 *
 * Which icon shows is decided by CSS, not React state. The usual
 * `useState`/`useEffect` mount guard exists only to avoid a hydration mismatch,
 * but next-themes already puts the `dark` class on <html> before React
 * hydrates, so a `dark:` variant gets the right answer in the very first paint
 * — no effect, no cascading render, and nothing to flash or shift. Reading
 * `resolvedTheme` inside the click handler is safe because clicks only happen
 * after hydration.
 *
 * This is intentionally NOT wired to the Zustand store yet. The store lands in
 * step 2 together with the terminal, at which point theme state moves there so
 * `theme dark` and this button drive the same source of truth.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={fa.theme.toggle}
      title={fa.theme.toggle}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Moon className="dark:hidden" aria-hidden />
      <Sun className="hidden dark:block" aria-hidden />
    </Button>
  );
}
