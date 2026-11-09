import Link from "next/link";

import { fa } from "@/content/fa";
import { listMediaAction } from "@/features/admin/actions-media";
import { AdminPageHeader } from "@/features/admin/components/ui";
import { MediaLibrary } from "@/features/admin/components/media-library";
import { requireAdmin } from "@/features/admin/lib/require-admin";

export const metadata = { title: fa.admin.mediaLibrary };

type SearchParams = Promise<{ project?: string; target?: string }>;

export const instant = false;

/**
 * Media library — images stored as commits in the bucket repository.
 *
 * Two modes from one page: the library itself, and a cover picker when it is
 * reached with `?project=<id>` from a project's editor. Same code, because a
 * picker that is a different page from the library would train the owner to
 * expect two places to look.
 */
export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();

  const { project, target } = await searchParams;
  // The same library serves two jobs: set the cover, or fill the gallery.
  // `target` only decides what a click on an image means.
  const mode = target === "gallery" ? "gallery" : "cover";
  const { items, configured } = await listMediaAction();

  return (
    <div>
      <AdminPageHeader
        title={fa.admin.mediaLibrary}
        backHref={project ? `/admin/projects/${project}` : "/admin"}
        action={
          project && (
            <Link
              href={`/admin/projects/${project}`}
              className="text-muted-foreground hover:text-foreground rounded-full border border-border/70 px-4 py-1.5 text-sm transition-colors"
            >
              {fa.admin.mediaBackToEditor}
            </Link>
          )
        }
      />

      {project && (
        <p className="text-muted-foreground mb-6 text-sm">
          {mode === "gallery" ? fa.admin.galleryFromLibrary : fa.admin.mediaForProject}
        </p>
      )}

      {configured ? (
        <MediaLibrary initialItems={items} projectId={project} mode={mode} />
      ) : (
        <p className="text-muted-foreground text-sm">{fa.admin.mediaNotConfigured}</p>
      )}
    </div>
  );
}
