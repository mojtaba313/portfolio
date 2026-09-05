import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { fa, site } from "@/content/fa";

/**
 * Step-1 foundation page.
 *
 * This is scaffolding, not the real home page — its only job is to make the
 * things that are expensive to get wrong visible in a browser: RTL flow,
 * Vazirmatn rendering, the light/dark token set, and the LTR terminal island.
 * The real sections replace this once the data layer exists.
 *
 * Note there is no `"use cache"` here and none is needed: the page reads no
 * data, so with Cache Components enabled it prerenders to a static shell on its
 * own. The build output confirms this — the route is marked `○ (Static)`.
 */
export default function Home() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      {/* `justify-between` + logical padding means this header flips correctly
          under dir="rtl" without any per-side overrides. */}
      <header className="mb-16 flex items-center justify-between gap-4">
        <span className="text-muted-foreground font-mono text-sm">
          {site.url.replace(/^https?:\/\//, "")}
        </span>
        <ThemeToggle />
      </header>

      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {site.name}
        </h1>
        <p className="text-primary text-lg font-medium">{site.role}</p>
        <p className="text-muted-foreground max-w-prose text-balance">
          {site.tagline}
        </p>
      </section>

      <hr className="border-border my-12" />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">{fa.scaffold.heading}</h2>
        <p className="text-muted-foreground max-w-prose">{fa.scaffold.body}</p>
      </section>

      <section className="mt-12 space-y-3">
        <h3 className="text-muted-foreground text-sm font-medium">
          {fa.scaffold.islandLabel}
        </h3>

        {/*
         * The LTR island. Three attributes do the work and all three matter:
         *   dir="ltr"  — flips direction for this subtree only.
         *   lang="en"  — stops the browser from applying Persian digit shaping
         *                or Persian font fallback inside the box.
         *   ltr-island — the custom utility in globals.css: bidi isolation,
         *                the Latin mono stack, and tabular lining figures.
         */}
        <pre
          dir="ltr"
          lang="en"
          className="ltr-island bg-muted/50 border-border overflow-x-auto rounded-lg border p-4 text-sm"
        >
          {`$ whoami
${site.name.toLowerCase()} — full-stack developer

$ node --version
v24.16.0

$ echo "digits stay Latin: 0123456789"
digits stay Latin: 0123456789`}
        </pre>

        <p className="text-muted-foreground max-w-prose text-sm">
          {fa.scaffold.islandNote}
        </p>
      </section>

      <section className="mt-12 space-y-3">
        <h3 className="text-muted-foreground text-sm font-medium">
          {fa.scaffold.buttonsLabel}
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">{fa.scaffold.primaryCta}</Button>
          <Button size="lg" variant="outline">
            {fa.scaffold.secondaryCta}
          </Button>
          <Button size="lg" variant="ghost">
            {fa.nav.skills}
          </Button>
        </div>
      </section>
    </main>
  );
}
