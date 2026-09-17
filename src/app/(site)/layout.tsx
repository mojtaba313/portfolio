import type { Metadata, Viewport } from "next";
import { Geist_Mono, Vazirmatn } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { fa, site } from "@/content/fa";
import { SceneBackground } from "@/features/scene-3d/components/scene-background";
import { ScrollAnimationsLoader } from "@/features/scroll-animations/components/scroll-animations-loader";
import { TerminalDock } from "@/features/terminal/components/terminal-dock";
import "../globals.css";

/**
 * Primary typeface. Vazirmatn ships in `next/font/google` as a variable font
 * (weights 100–900) with an `arabic` subset, so it covers Persian text and
 * Latin fallback in one download and is self-hosted from our own origin — no
 * request ever reaches Google.
 *
 * `fallback` matters more than usual here: the default `sans-serif` on Windows
 * renders Persian poorly, so Tahoma is listed first as the well-established
 * Persian-safe system font.
 */
const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
  fallback: ["Tahoma", "system-ui", "sans-serif"],
});

/**
 * Latin monospace, used for code snippets, numerals and the terminal panel.
 * Kept separate from the Persian face on purpose — the terminal is a
 * deliberate LTR island and must never inherit Persian glyphs or digits.
 */
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  // Makes Open Graph and canonical URLs resolve absolutely.
  metadataBase: new URL(site.url),
  title: {
    default: fa.meta.title,
    template: fa.meta.titleTemplate,
  },
  description: fa.meta.description,
  openGraph: {
    type: "website",
    locale: "fa_IR",
    title: fa.meta.title,
    description: fa.meta.description,
    siteName: site.name,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /*
     * `dir="rtl"` here is the document-wide default; every Tailwind logical
     * utility (ps-*, ms-*, start-*, end-*) resolves against it. The terminal
     * panel opts back out locally rather than this being relaxed globally.
     *
     * `suppressHydrationWarning` is required by next-themes: it writes the
     * theme class onto <html> before React hydrates, so server and client
     * markup differ by design on this one element.
     */
    <html
      lang="fa"
      dir="rtl"
      suppressHydrationWarning
      className={`${vazirmatn.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          // Prevents every colour transition on the page from firing at once
          // when the theme flips.
          disableTransitionOnChange
        >
          {/*
           * Keyboard users land here first. Hidden until focused, at which
           * point it becomes a visible button — the terminal panel adds more
           * keyboard surface later, so this needs to work from the start.
           */}
          <a
            href="#main"
            className="bg-background text-foreground focus-visible:ring-ring sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:start-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:px-4 focus-visible:py-2 focus-visible:ring-2 focus-visible:outline-none"
          >
            {fa.nav.skipToContent}
          </a>
          {children}

          {/*
           * Global chrome, mounted once for every route in the group. Each is a
           * Client Component in an otherwise server-rendered layout, which is
           * fine — only these subtrees ship to the browser, and the heavy
           * libraries behind them (three.js, GSAP) stay in dynamic chunks that
           * never join the initial payload.
           */}
          <SceneBackground />
          <TerminalDock />
          {/*
           * The animation loader deliberately renders last. It hydrates after
           * every content subtree, so its scroll listener — and therefore any
           * GSAP inline style — can only ever touch fully-hydrated DOM. If it
           * ran earlier, a fast scroll (or scroll restoration) could let
           * `gsap.from()` write starting styles onto still-unhydrated server
           * HTML, and React would fail hydration on the mismatch.
           */}
          <ScrollAnimationsLoader />
        </ThemeProvider>
      </body>
    </html>
  );
}
