/**
 * Graph colours that do not need d3.
 *
 * Split out of force-layout.ts on purpose: the legend and other statically
 * imported components need these constants, and importing them from a module
 * that also imports d3-force would drag the whole physics engine into the
 * initial bundle. This file must never import d3 — that is the entire reason
 * it exists.
 */

/**
 * Fallback category palette, used only when the theme tokens cannot be read.
 *
 * The live palette is `--category-*` in globals.css, resolved per mode by
 * `resolveCategoryPalette()` below so canvas nodes follow light/dark and any
 * future palette change with no code touched anywhere else.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  LANGUAGE: "#3178c6",
  FRONTEND: "#38bdf8",
  BACKEND: "#5fa04e",
  DATABASE: "#4169e1",
  DEVOPS: "#e95420",
  TOOLING: "#f05033",
};

/** Project nodes stay neutral so the coloured skill nodes carry the meaning. */
export const PROJECT_NODE_COLOR = "#a3a3a3";

const CATEGORY_KEYS = [
  "LANGUAGE",
  "FRONTEND",
  "BACKEND",
  "DATABASE",
  "DEVOPS",
  "TOOLING",
] as const;

/**
 * Reads the live `--category-*` tokens from the document.
 *
 * Canvas cannot consume Tailwind classes, so this bridges the theme into
 * concrete colour strings. `oklch()` values work directly as canvas fill
 * styles in all modern browsers. Falls back to CATEGORY_COLORS when there is
 * no document (SSR, tests) or a token is missing, so a partial theme can never
 * produce an invisible node.
 */
export function resolveCategoryPalette(): Record<string, string> {
  const palette: Record<string, string> = { ...CATEGORY_COLORS };

  if (typeof document === "undefined") return palette;

  const styles = getComputedStyle(document.documentElement);
  for (const key of CATEGORY_KEYS) {
    const value = styles
      .getPropertyValue(`--category-${key.toLowerCase()}`)
      .trim();
    if (value) palette[key] = value;
  }

  return palette;
}
