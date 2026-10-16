import { fa } from "@/content/fa";

/**
 * Persian names for the tracked section ids, in the owner's own vocabulary —
 * the same words the site itself uses, so a session row saying "پروژه‌ها"
 * matches what a visitor was looking at on screen.
 *
 * Kept out of `lib/sections.ts` on purpose: that registry is client-safe and
 * import-light, and admin-only copy has no business riding along into the
 * public bundle.
 */
const LABELS: Record<string, string> = {
  top: fa.admin.visitSectionTop,
  projects: fa.admin.visitSectionProjects,
  "skills-graph": fa.admin.visitSectionSkills,
  "github-stats": fa.admin.visitSectionGithub,
  contact: fa.admin.visitSectionContact,
};

export function sectionLabel(sectionId: string): string {
  return LABELS[sectionId] ?? sectionId;
}