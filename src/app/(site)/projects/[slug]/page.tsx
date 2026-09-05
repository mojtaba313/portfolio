import { ArrowRight, Code, ExternalLink } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SkillBadge } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { fa } from "@/content/fa";
import {
  getProjectBySlug,
  getPublishedProjectSlugs,
  type ProjectDetail,
} from "@/lib/db/projects";
import { formatJalaliMonth, toIsoDate } from "@/lib/format-date";

/**
 * Cached single-project read.
 *
 * The slug is an argument, so it becomes part of the cache key and each project
 * gets its own entry. Extracted from the page body because `generateMetadata`
 * needs the same data — without a shared cached function the row would be
 * fetched twice per render.
 */
async function getCachedProject(slug: string): Promise<ProjectDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("projects", `project:${slug}`);

  return getProjectBySlug(slug);
}

/**
 * Prerenders every published project at build time.
 *
 * With Cache Components this is what puts the concrete pages in the static
 * shell rather than serving an App Shell that upgrades on first visit. The list
 * is small and known, so there is no reason to defer any of it.
 */
export async function generateStaticParams() {
  const slugs = await getPublishedProjectSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;

  /*
   * The database read is guarded, and the guard is load-bearing rather than
   * defensive habit: `generateMetadata` runs before the page's component tree
   * exists, so an error thrown here is outside every error boundary and
   * `error.tsx` cannot catch it. Metadata is decoration and must never be the
   * reason a page is unreachable.
   */
  let project: ProjectDetail | null = null;
  try {
    project = await getCachedProject(slug);
  } catch {
    // The page render hits the same fault and surfaces it through the boundary.
    return { title: fa.project.notFoundTitle, robots: { index: false } };
  }

  if (!project) {
    /*
     * `noindex` matters here, and it compensates for a real limitation.
     *
     * Because the project read sits below a `<Suspense>` boundary, the 200
     * status is committed with the shell before `notFound()` runs — so an
     * unknown slug renders the correct Persian "not found" page but cannot
     * return a 404. That is a soft 404, and on a site whose whole point is being
     * found by clients and recruiters, letting crawlers index nonexistent URLs
     * is the actual harm. A robots meta tag is the layer that controls
     * indexing, so it is the right place to fix it — rather than reverting to a
     * blocking read and reintroducing the bare English 500 on a Persian site.
     *
     * `generateMetadata` resolves before the shell is flushed, so this tag does
     * make it into the initial HTML head where crawlers will see it.
     */
    return { title: fa.project.notFoundTitle, robots: { index: false } };
  }

  return {
    // The layout's template appends the site name.
    title: project.title,
    description: project.summary,
    openGraph: {
      title: project.title,
      description: project.summary,
      type: "article",
      ...(project.coverImage ? { images: [{ url: project.coverImage }] } : {}),
    },
  };
}

/**
 * Fallback shown while the project body streams.
 *
 * Sized to roughly match the real content so the page does not jump when the
 * body arrives. `animate-pulse` is a CSS animation, so the global
 * prefers-reduced-motion rule in globals.css already neutralises it.
 */
function ProjectSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="space-y-3">
        <div className="bg-muted h-10 w-2/3 rounded-lg animate-pulse" />
        <div className="bg-muted h-6 w-full rounded-lg animate-pulse" />
      </div>
      <div className="bg-muted h-28 rounded-xl animate-pulse" />
      <div className="space-y-2">
        <div className="bg-muted h-4 w-full rounded animate-pulse" />
        <div className="bg-muted h-4 w-5/6 rounded animate-pulse" />
      </div>
    </div>
  );
}

/**
 * The project content itself.
 *
 * Takes the `params` promise rather than a resolved slug so the `await` happens
 * inside the Suspense boundary. See the note on the page component for why that
 * placement matters.
 */
async function ProjectBody({
  params,
}: Pick<PageProps<"/projects/[slug]">, "params">) {
  const { slug } = await params;
  const project = await getCachedProject(slug);

  // Covers both a genuinely missing slug and a draft/archived one, since the
  // repository query filters on status.
  if (!project) notFound();

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {project.title}
        </h1>
        <p className="text-muted-foreground text-lg text-balance">
          {project.summary}
        </p>
      </header>

      {(project.liveUrl || project.repoUrl) && (
        <div className="flex flex-wrap gap-3">
          {project.liveUrl && (
            <Button asChild>
              {/* rel="noreferrer" alongside noopener: external links should not
                  leak the referring URL. */}
              <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                {fa.project.viewLive}
              </a>
            </Button>
          )}
          {project.repoUrl && (
            <Button variant="outline" asChild>
              <a href={project.repoUrl} target="_blank" rel="noopener noreferrer">
                {/* lucide-react 1.x dropped brand icons, so there is no GitHub
                    mark; Code matches the "source code" label anyway. */}
                <Code aria-hidden />
                {fa.project.viewRepo}
              </a>
            </Button>
          )}
        </div>
      )}

      {/* Metadata pairs. `dl` because these are genuinely term/description
          pairs, which gives assistive tech the association for free. */}
      {(project.client || project.completedAt) && (
        <dl className="border-border grid gap-4 rounded-xl border p-5 sm:grid-cols-2">
          {project.client && (
            <div className="space-y-1">
              <dt className="text-muted-foreground text-xs">
                {fa.project.client}
              </dt>
              <dd className="text-sm font-medium">{project.client}</dd>
            </div>
          )}
          {project.completedAt && (
            <div className="space-y-1">
              <dt className="text-muted-foreground text-xs">
                {fa.project.completedAt}
              </dt>
              <dd className="text-sm font-medium">
                <time dateTime={toIsoDate(project.completedAt)}>
                  {formatJalaliMonth(project.completedAt)}
                </time>
              </dd>
            </div>
          )}
        </dl>
      )}

      {project.description && (
        <div className="space-y-4">
          {/*
           * Split on blank lines rather than rendering Markdown. The schema says
           * the field is Markdown and it will get a real renderer, but shipping
           * `dangerouslySetInnerHTML` over unsanitised content to save a
           * dependency is not a trade worth making.
           */}
          {project.description.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index} className="text-muted-foreground leading-loose">
              {paragraph}
            </p>
          ))}
        </div>
      )}

      {project.skills.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">{fa.project.skillsUsed}</h2>
          <ul className="flex flex-wrap gap-2">
            {project.skills.map((skill) => (
              <li key={skill.slug}>
                <SkillBadge skill={skill} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/**
 * Not async, and that is deliberate: this component awaits nothing, so the back
 * link and page frame prerender into the static shell while the body streams
 * into the Suspense fallback.
 *
 * The structure was arrived at by measurement, not style. With the `await`
 * directly in this component, a request for a slug outside
 * `generateStaticParams` had nothing to stream into — so when the database was
 * unreachable the whole route failed with a bare English "Internal Server
 * Error", bypassing error.tsx entirely, on a Persian-only site. Moving the read
 * below a boundary means the shell always renders, a failure lands in the error
 * boundary, and a merely *slow* database delays only the body instead of
 * blocking the whole page.
 *
 * Known slugs are unaffected: their cached read resolves during prerender, so
 * they still ship as complete static HTML.
 */
export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Button variant="ghost" size="sm" asChild className="mb-8">
        <Link href="/">
          {/* The arrow points right, which in RTL is "back". Mirroring it would
              point it away from the direction of travel. */}
          <ArrowRight aria-hidden />
          {fa.project.backToProjects}
        </Link>
      </Button>

      <Suspense fallback={<ProjectSkeleton />}>
        <ProjectBody params={params} />
      </Suspense>
    </main>
  );
}
