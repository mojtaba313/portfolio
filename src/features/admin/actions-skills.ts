"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

import { requireAdmin } from "./lib/require-admin";
import { adminSkillSchema, type AdminActionState } from "./lib/validation";
export type { AdminActionState };

function refreshSkillCaches(): void {
  updateTag("skills");
  updateTag("projects");
  revalidatePath("/");
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

export async function createSkillAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = adminSkillSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { error: "ورودی‌ها معتبر نیستند — همهٔ فیلدها را بررسی کنید." };
  }

  try {
    await prisma.skill.create({ data: parsed.data });
    refreshSkillCaches();
  } catch (error) {
    return { error: friendlyError(error) };
  }
  redirect("/admin/skills");
}

export async function updateSkillAction(
  id: string,
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = adminSkillSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { error: "ورودی‌ها معتبر نیستند — همهٔ فیلدها را بررسی کنید." };
  }

  try {
    await prisma.skill.update({ where: { id }, data: parsed.data });
    refreshSkillCaches();
  } catch (error) {
    return { error: friendlyError(error) };
  }
  redirect("/admin/skills");
}

export async function deleteSkillAction(id: string): Promise<void> {
  await requireAdmin();
  const links = await prisma.projectSkill.count({ where: { skillId: id } });
  if (links > 0) {
    // Foreign-key restrict would throw a raw P2003; say it in Persian first.
    redirect("/admin/skills?error=linked");
  }
  await prisma.skill.delete({ where: { id } });
  refreshSkillCaches();
  redirect("/admin/skills");
}
