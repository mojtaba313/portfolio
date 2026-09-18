import Image from "next/image";

import type { ProjectJourneyItem } from "@/lib/db/projects";

/*
 * Cover art for a project, shared by the journey stage, the mobile list and
 * the case-study page.
 *
 * Local paths (under /public) go through `next/image` for sizing and lazy
 * loading; remote URLs render a plain lazy `<img>` so no `remotePatterns`
 * config is needed. Both carry an `alt` — the old `bg-cover` div had none,
 * no `srcset`, and no loading hint.
 *
 * The melt mask is deliberately shallow (8%/92%): the old 20%/80% dissolved
 * two-fifths of the image and flattened every cover into a haze.
 */
export function ProjectCoverImage({
  project,
  sizes,
  eager = false,
  className,
}: {
  project: Pick<ProjectJourneyItem, "title" | "coverImage">;
  sizes: string;
  eager?: boolean;
  className?: string;
}) {
  const alt = `پیش‌نمایش ${project.title}`;
  const cover = project.coverImage;

  if (!cover) return null;

  if (cover.startsWith("/")) {
    return (
      <Image
        src={cover}
        alt={alt}
        fill
        sizes={sizes}
        priority={eager}
        loading={eager ? undefined : "lazy"}
        className={className ?? "object-cover"}
      />
    );
  }

  return (
    // Remote covers bypass next/image so no remotePatterns config is needed;
    // lazy loading + async decoding keep them off the critical path.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cover}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className ?? "h-full w-full object-cover"}
    />
  );
}

/**
 * Full-bleed cover preview for a project. Projects without a cover fall back
 * to a brand gradient with the project's initial, so the stage never renders
 * an empty panel that reads as broken.
 */
export function ProjectPreview({ project }: { project: ProjectJourneyItem }) {
  const maskGradient = `linear-gradient(to top, transparent 0%, black 8%, black 92%, transparent 100%)`;
  const mask = {
    maskImage: maskGradient,
    WebkitMaskImage: maskGradient,
  };

  if (!project.coverImage) {
    return (
      <div
        data-journey-preview
        aria-hidden
        className="from-primary/20 via-background to-background relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br"
        style={mask}
      >
        <span
          aria-hidden
          className="text-primary/30 text-8xl font-black tracking-tight select-none"
        >
          {project.title.charAt(0)}
        </span>
        <span
          aria-hidden
          className="bg-primary/10 absolute -bottom-16 -start-16 size-64 rounded-full blur-3xl"
        />
      </div>
    );
  }

  return (
    <div data-journey-preview className="relative h-full w-full" style={mask}>
      <ProjectCoverImage project={project} sizes="(min-width: 1024px) 55vw, 100vw" />
    </div>
  );
}
