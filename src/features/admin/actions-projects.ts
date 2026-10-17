"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";

import { fa } from "@/content/fa";
import { prisma } from "@/lib/db/prisma";
import { isAllowedImageUrl } from "@/lib/media/image-url";

import { requireAdmin } from "./lib/require-admin";
import {
  adminProjectSchema,
  type AdminActionState,
} from "./lib/validation";
export type { AdminActionState };

function refreshProjectCaches(slug: string): void {
  // updateTag, not revalidateTag: inside an action this expires immediately
  // with read-your-own-writes, so the redirect lands on fresh data.
  updateTag("projects");
  updateTag(`project:${slug}`);
  updateTag("skills");
  revalidatePath("/");
}

/** Skill links from the edit form: `skill:<id>` checkboxes + `weight:<id>`. */
function parseSkillLinks(
  formData: FormData,
): { skillId: string; weight: number }[] {
  const links: { skillId: string; weight: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("skill:") || value !== "on") continue;
    const skillId = key.slice("skill:".length);
    const raw = Number.parseInt(
      String(formData.get(`weight:${skillId}`) ?? "1"),
      10,
    );
    links.push({
      skillId,
      weight: Number.isFinite(raw) ? Math.min(10, Math.max(1, raw)) : 1,
    });
  }
  return links;
}

function friendlyError(error: unknown): string {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "این شناسه قبلاً استفاده شده است.";
  }
  return "خطایی رخ داد — دوباره تلاش کنید.";
}

export async function createProjectAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = adminProjectSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { error: "ورودی‌ها معتبر نیستند — همهٔ فیلدها را بررسی کنید." };
  }

  try {
    const project = await prisma.project.create({
      data: {
        ...parsed.data,
        skills: {
          create: parseSkillLinks(formData).map(({ skillId, weight }) => ({
            weight,
            skill: { connect: { id: skillId } },
          })),
        },
      },
    });
    refreshProjectCaches(project.slug);
  } catch (error) {
    return { error: friendlyError(error) };
  }
  redirect("/admin/projects");
}

export async function updateProjectAction(
  id: string,
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = adminProjectSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { error: "ورودی‌ها معتبر نیستند — همهٔ فیلدها را بررسی کنید." };
  }

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...parsed.data,
        skills: {
          deleteMany: {},
          create: parseSkillLinks(formData).map(({ skillId, weight }) => ({
            weight,
            skill: { connect: { id: skillId } },
          })),
        },
      },
    });
    refreshProjectCaches(project.slug);
  } catch (error) {
    return { error: friendlyError(error) };
  }
  redirect("/admin/projects");
}

export async function deleteProjectAction(id: string): Promise<void> {
  await requireAdmin();
  const project = await prisma.project.findUnique({
    where: { id },
    select: { slug: true },
  });
  await prisma.projectSkill.deleteMany({ where: { projectId: id } });
  await prisma.project.delete({ where: { id } });
  if (project) refreshProjectCaches(project.slug);
  else {
    updateTag("projects");
    revalidatePath("/");
  }
  redirect("/admin/projects");
}

/**
 * Gallery management.
 *
 * Split out from the main form on purpose: a project can gain or lose an image
 * without rewriting the project row, so these are their own small actions with
 * their own result type rather than extra `FormData` fields bolted onto
 * `updateProjectAction`. Each one re-checks the admin session — a server action
 * is an endpoint anyone can POST to.
 */

export type GalleryActionResult = { ok: boolean; error?: string };

/** Appends an image to the end of the gallery. */
export async function addProjectImageAction(input: {
  projectId: string;
  url: string;
}): Promise<GalleryActionResult> {
  await requireAdmin();

  if (!isAllowedImageUrl(input.url)) {
    return { ok: false, error: fa.admin.galleryBadUrl };
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { slug: true },
    });
    if (!project) return { ok: false, error: fa.admin.galleryNoProject };

    // The same screenshot twice in one gallery is always a mis-click, and it
    // would render as a duplicate the owner then has to hunt for.
    const existing = await prisma.projectImage.findFirst({
      where: { projectId: input.projectId, url: input.url },
      select: { id: true },
    });
    if (existing) return { ok: true };

    const last = await prisma.projectImage.findFirst({
      where: { projectId: input.projectId },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });

    await prisma.projectImage.create({
      data: {
        projectId: input.projectId,
        url: input.url,
        displayOrder: (last?.displayOrder ?? -1) + 1,
      },
    });

    refreshProjectCaches(project.slug);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function removeProjectImageAction(input: {
  projectId: string;
  imageId: string;
}): Promise<GalleryActionResult> {
  await requireAdmin();

  try {
    // Scoped by projectId as well as id: an id from another project must not be
    // deletable by guessing it against this form.
    await prisma.projectImage.deleteMany({
      where: { id: input.imageId, projectId: input.projectId },
    });
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { slug: true },
    });
    if (project) refreshProjectCaches(project.slug);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

/**
 * Moves an image one slot up or down by swapping positions with its neighbour.
 *
 * Sparse ordering means "the neighbour" is simply the next row in sort order —
 * no renumbering pass, and a gap left by an earlier delete heals itself the
 * next time someone appends.
 */
export async function moveProjectImageAction(input: {
  projectId: string;
  imageId: string;
  direction: "up" | "down";
}): Promise<GalleryActionResult> {
  await requireAdmin();

  try {
    const images = await prisma.projectImage.findMany({
      where: { projectId: input.projectId },
      orderBy: { displayOrder: "asc" },
      select: { id: true, displayOrder: true },
    });

    const index = images.findIndex((image) => image.id === input.imageId);
    if (index === -1) return { ok: false, error: fa.admin.galleryNoImage };

    const swapWith = input.direction === "up" ? index - 1 : index + 1;
    const neighbour = images[swapWith];
    if (!neighbour) return { ok: true }; // already at the end: nothing to do

    // A transaction because a half-applied swap would leave the gallery in an
    // order the owner never chose, and the reader has no way to tell.
    await prisma.$transaction([
      prisma.projectImage.update({
        where: { id: images[index].id },
        data: { displayOrder: neighbour.displayOrder },
      }),
      prisma.projectImage.update({
        where: { id: neighbour.id },
        data: { displayOrder: images[index].displayOrder },
      }),
    ]);

    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { slug: true },
    });
    if (project) refreshProjectCaches(project.slug);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}
