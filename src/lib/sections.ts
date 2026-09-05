/**
 * Ids of the page sections that terminal commands can jump to.
 *
 * Centralised so a command can reference a section that does not exist yet.
 * `skills --graph` is written in step 2, but the element it scrolls to only
 * appears in step 7 — with the id in one place, the two sides cannot drift, and
 * a command targeting a missing section degrades into an honest message rather
 * than a silent no-op.
 */
export const SECTION_IDS = {
  projects: "projects",
  skills: "skills-graph",
  github: "github-stats",
  contact: "contact",
} as const;

export type SectionId = (typeof SECTION_IDS)[keyof typeof SECTION_IDS];
