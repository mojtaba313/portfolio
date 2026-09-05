import Link from "next/link";

import { Button } from "@/components/ui/button";
import { fa } from "@/content/fa";

/**
 * Shown when `notFound()` fires from the project detail page — either the slug
 * does not exist or the project is not published.
 *
 * Scoped to the projects subtree rather than global, so the message can name
 * what was missing instead of saying "page not found".
 */
export default function ProjectNotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-24">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {fa.project.notFoundTitle}
        </h1>
        <p className="text-muted-foreground">{fa.project.notFoundBody}</p>
        <Button asChild className="mt-2">
          <Link href="/">{fa.project.backToProjects}</Link>
        </Button>
      </div>
    </main>
  );
}
