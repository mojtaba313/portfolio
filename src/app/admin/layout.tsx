import { Vazirmatn } from "next/font/google";
import Link from "next/link";

import { fa } from "@/content/fa";

import "../globals.css";
import { logoutAction } from "@/features/admin/actions";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
  fallback: ["Tahoma", "system-ui", "sans-serif"],
});

export const metadata = {
  title: { default: fa.admin.title, template: `%s — ${fa.admin.title}` },
  robots: { index: false, follow: false },
};

/*
 * Owner tool, never instant: every page here reads the live database, so
 * there is no static shell to serve and no instant navigation to protect.
 * This opts the whole admin subtree out of that validation instead of
 * wrapping every read in Suspense or caching data that must stay fresh.
 */
export const instant = false;

const NAV = [
  { href: "/admin", label: fa.admin.dashboard, exact: true },
  { href: "/admin/projects", label: fa.admin.projects, exact: false },
  { href: "/admin/skills", label: fa.admin.skills, exact: false },
  { href: "/admin/jokes", label: fa.admin.jokes, exact: false },
  { href: "/admin/messages", label: fa.admin.messages, exact: false },
] as const;

/**
 * Second root layout (the public one lives in `(site)/layout.tsx`):
 * the admin area deliberately shares nothing with the public site — no hero
 * chrome, no terminal, no scroll choreography. Forced dark: this is an
 * owner tool, and one fixed theme means no theming machinery to maintain.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} dark h-full`}>
      <body className="bg-background text-foreground min-h-full antialiased">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <nav aria-label={fa.admin.title} className="flex flex-wrap gap-1">
              {NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-full px-3.5 py-1.5 text-sm transition-colors"
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-sm transition-colors"
              >
                {fa.admin.viewSite}
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="text-muted-foreground hover:text-foreground rounded-full border border-border/70 px-4 py-1.5 text-sm transition-colors"
                >
                  {fa.admin.logout}
                </button>
              </form>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
