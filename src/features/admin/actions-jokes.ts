"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

import { requireAdmin } from "./lib/require-admin";
import {
  adminJokeSchema,
  type AdminActionState,
} from "./lib/validation";

function friendlyError(error: unknown): string {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "این شناسه قبلاً استفاده شده است.";
  }
  return "خطایی رخ داد — دوباره تلاش کنید.";
}

export async function createJokeAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState & { ok?: true }> {
  await requireAdmin();
  const parsed = adminJokeSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { error: "ورودی‌ها معتبر نیستند — همهٔ فیلدها را بررسی کنید." };
  }

  try {
    await prisma.joke.create({ data: parsed.data });
  } catch (error) {
    return { error: friendlyError(error) };
  }
  // No redirect: this form lives ON the list page, and a same-URL redirect
  // after a useActionState action does not refresh the list. The client
  // resets the form and refreshes the route on `ok` instead.
  return { ok: true };
}

export async function toggleJokeAction(id: string): Promise<void> {
  await requireAdmin();
  const joke = await prisma.joke.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!joke) redirect("/admin/jokes");
  await prisma.joke.update({
    where: { id },
    data: { active: !joke.active },
  });
  redirect("/admin/jokes");
}

export async function deleteJokeAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.joke.delete({ where: { id } });
  redirect("/admin/jokes");
}
