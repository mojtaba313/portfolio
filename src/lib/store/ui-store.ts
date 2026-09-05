import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Global UI toggles.
 *
 * Separate from the terminal's own store on purpose. `features/scene-3d` and a
 * future settings menu both need to read the 3D flag, and importing it from
 * `features/terminal` would point the dependency arrow the wrong way — a
 * decorative background has no business depending on the terminal.
 *
 * Note what is NOT here: the theme. next-themes already owns it, persists it,
 * handles the pre-hydration flash and syncs it across tabs, and `useTheme()` is
 * readable from anywhere. Mirroring it into Zustand would create a second
 * source of truth to keep in sync — exactly the bug class this store exists to
 * avoid. The terminal's `theme` command calls next-themes directly.
 */

type UiState = {
  /**
   * Whether the ambient 3D background should run. Nothing consumes this until
   * step 8; the terminal's `3d --toggle` command drives it from day one so the
   * scene has a switch to read the moment it exists.
   */
  threeDEnabled: boolean;
  toggleThreeD: () => void;
  setThreeDEnabled: (enabled: boolean) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      threeDEnabled: true,
      toggleThreeD: () => set((s) => ({ threeDEnabled: !s.threeDEnabled })),
      setThreeDEnabled: (enabled) => set({ threeDEnabled: enabled }),
    }),
    {
      name: "portfolio-ui",
      /*
       * Only the flag is persisted; actions are recreated on load. Anything
       * read from localStorage differs between the server render and the first
       * client render, so any component reading `threeDEnabled` must be
       * client-only — which the 3D scene already is, since it is lazy-loaded
       * with `ssr: false`.
       */
      partialize: (s) => ({ threeDEnabled: s.threeDEnabled }),
    },
  ),
);
