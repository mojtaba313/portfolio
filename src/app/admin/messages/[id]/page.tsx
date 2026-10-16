import { notFound } from "next/navigation";

import { fa } from "@/content/fa";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import { AdminPageHeader } from "@/features/admin/components/ui";
import { AdminDeleteButton } from "@/features/admin/components/buttons";
import {
  deleteMessageAction,
  markMessageReadAction,
} from "@/features/admin/actions-messages";
import { markMessageRead } from "@/lib/db/contact";
import { prisma } from "@/lib/db/prisma";
import { formatJalaliMonth } from "@/lib/format-date";

/**
 * One message, marked read on open.
 *
 * Reading marks it — opening the row IS the acknowledgement, so there is no
 * separate "mark read" click to forget. The write happens in the page, not in
 * an effect, so it runs exactly once per render of this route.
 */
export default async function AdminMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const message = await prisma.contactMessage.findUnique({ where: { id } });
  if (!message) notFound();
  if (!message.readAt) await markMessageRead(id);

  return (
    <div>
      <AdminPageHeader title={message.name} backHref="/admin/messages" />

      <article className="max-w-2xl space-y-5 rounded-3xl border border-border/70 bg-white/[0.02] p-6 sm:p-8">
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span dir="ltr" className="font-mono">
            {message.email}
          </span>
          {message.subject && <span>{message.subject}</span>}
          <span>{formatJalaliMonth(message.createdAt)}</span>
          <span className="font-mono">{message.deliveryStatus}</span>
        </div>
        <p className="leading-8 whitespace-pre-wrap">{message.message}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <form action={markMessageReadAction.bind(null, message.id)}>
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground h-11 rounded-xl border border-border/70 px-5 text-sm transition-colors"
            >
              {fa.admin.markRead}
            </button>
          </form>
          <form action={deleteMessageAction.bind(null, message.id)}>
            <AdminDeleteButton />
          </form>
        </div>
      </article>
    </div>
  );
}
