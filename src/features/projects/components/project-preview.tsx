import type { ProjectJourneyItem } from "@/lib/db/projects";

/**
 * Full-bleed cover preview for a project. The cover image fills the stage
 * and is softly masked at the top and bottom so it melts into the page.
 * Projects without a cover fall back to a brand gradient so the stage never
 * renders a broken `url(null)` background.
 */
export function ProjectPreview({ project }: { project: ProjectJourneyItem }) {
  const maskGradient = `linear-gradient(to top, transparent 0%, black 20%, black 80%, transparent 100%)`;

  if (!project.coverImage) {
    return (
      <div
        data-journey-preview
        aria-hidden
        className="from-primary/15 via-background to-background relative h-full w-full bg-gradient-to-br"
        style={{
          maskImage: maskGradient,
          WebkitMaskImage: maskGradient,
        }}
      />
    );
  }

  return (
    <div
      data-journey-preview
      className="relative h-full w-full bg-center bg-cover bg-no-repeat"
      style={{
        backgroundImage: `url(${project.coverImage})`,
        maskImage: maskGradient,
        WebkitMaskImage: maskGradient,
      }}
    />
  );
}
