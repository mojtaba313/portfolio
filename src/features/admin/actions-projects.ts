"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

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
