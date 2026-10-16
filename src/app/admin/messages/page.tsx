import Link from "next/link";

import { fa } from "@/content/fa";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import { AdminPageHeader } from "@/features/admin/components/ui";
import { listContactMessages } from "@/lib/db/contact";
import { formatJalaliMonth } from "@/lib/format-date";
import { cn } from "@/lib/utils";

/** Owner inbox: newest first, unread marked with a dot. */
export default async function AdminMessagesPage() {
  await requireAdmin();
  const messages = await listContactMessages();

  return (
    <div>
      <AdminPageHeader title={fa.admin.messages} backHref="/admin" />

      {messages.length === 0 ? (
        <p className="text-muted-foreground text-sm">{fa.admin.emptyMessages}</p>
      ) : (
        <ul className="space-y-2">
          {messages.map((message) => (
            <li key={message.id}>
              <Link
                href={`/admin/messages/${message.id}`}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-white/[0.02] px-4 py-3 transition-colors hover:border-primary/50"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    message.readAt
                      ? "bg-muted-foreground/30"
                      : "bg-primary shadow-[0_0_12px_var(--primary)]",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {message.name}
                    <span className="text-muted-foreground font-normal">
                      {" · "}
                      {message.subject ?? "—"}
                    </span>
                  </p>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    <span dir="ltr">{message.email}</span>
                    {" · "}
                    {formatJalaliMonth(message.createdAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 font-mono text-[11px]",
                    message.deliveryStatus === "SENT" &&
                      "border-emerald-500/30 text-emerald-400",
                    message.deliveryStatus === "FAILED" &&
                      "border-destructive/40 text-destructive",
                    message.deliveryStatus === "PENDING" &&
                      "border-border/70 text-muted-foreground",
                  )}
                >
                  {message.deliveryStatus}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
