"use client";

import dynamic from "next/dynamic";

/*
 * The journey animator loads on its own, behind a dynamic boundary, so GSAP
 * never joins the initial bundle. The section above it is a Server Component,
 * so its markup is already in the static shell; this chunk only layers the
 * scroll choreography on top once it arrives. If it never arrives, the journey
 * stays a readable stack.
 */
const ProjectJourneyAnimator = dynamic(
  () =>
    import("./project-journey-animator").then(
      (module) => module.ProjectJourneyAnimator,
    ),
  { ssr: false },
);

export function ProjectJourneyLoader() {
  return <ProjectJourneyAnimator />;
}
