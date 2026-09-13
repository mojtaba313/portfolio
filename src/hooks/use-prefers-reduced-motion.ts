import { useSyncExternalStore } from "react";

/**
 * Whether the visitor prefers reduced motion — safe to branch on during render.
 *
 * Prefer this over motion's `useReducedMotion` anywhere the value affects
 * rendered output. Motion's version snapshots a module-level value during
 * render that is `null` on the server and a boolean on the client, so a
 * component branching on it renders different HTML on each side and throws a
 * hydration error for exactly the users the preference protects (verified:
 * #418 on every reduced-motion load). This hook instead renders the server
 * snapshot (`false`) during hydration and re-reads afterwards, which is
 * precisely the contract `useSyncExternalStore` exists for.
 *
 * Where the value only guards effects or event handlers (parallax loops,
 * magnetic buttons), either hook is fine — no rendered output depends on it.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    // Client snapshot, re-read after hydration (and kept live across OS changes).
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    // Server snapshot: assume full motion so hydration matches the SSR HTML.
    // Reduced-motion visitors get one extra paint swapping to the static
    // variant — invisible, since it happens before anything animates.
    () => false,
  );
}
