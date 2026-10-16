"use server";

import { redirect } from "next/navigation";

import { markMessageRead } from "@/lib/db/contact";
import { prisma } from "@/lib/db/prisma";

import { requireAdmin } from "./lib/require-admin";

export async function markMessageReadAction(id: string): Promise<void> {
  await requireAdmin();
  await markMessageRead(id);
  redirect(`/admin/messages/${id}`);
}

export async function deleteMessageAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.contactMessage.delete({ where: { id } });
  redirect("/admin/messages");
}
