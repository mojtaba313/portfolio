import { fa } from "@/content/fa";
import { AdminPageHeader } from "@/features/admin/components/ui";
import {
  IpBadge,
  VisitFilterForm,
  VisitsTabs,
} from "@/features/admin/components/visits";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import { listIps } from "@/lib/db/visits";
import { formatJalaliDateTime } from "@/lib/format-date";

export const metadata = { title: fa.admin.visitsTabIps };

type SearchParams = Promise<{ scope?: string }>;

/**
 * Addresses, not people: which networks visited, how often, and how many
 * distinct visitors came out of each.
 *
 * The employer-and-the-CEO case lives here — same office IP, `visitorCount: 2`
 * — and the per-IP link shows every session from that address side by side.
 */
export default async function AdminIpsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();

  const params = await searchParams;
  const scope =
    params.scope === "human" || params.scope === "bot" ? params.scope : "all";
  const rows = await listIps({ scope });

  return (
    <div>
      <AdminPageHeader title={fa.admin.visitsTabIps} backHref="/admin" />
      <VisitsTabs active="ips" />

      <VisitFilterForm
        q=""
        scope={scope}
        placeholder={fa.admin.visitSearch}
        action="/admin/visits/ips"
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{fa.admin.emptyIps}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.ip}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-border/70 bg-white/[0.02] px-4 py-3"
            >
              <IpBadge ip={row.ip} country={row.country} />
              <span className="text-muted-foreground text-xs">
                {row.visitorCount.toLocaleString("fa-IR")}{" "}
                {fa.admin.visitsTabVisitors} ·{" "}
                {row.sessionCount.toLocaleString("fa-IR")}{" "}
                {fa.admin.visitSessions2}
              </span>
              {row.lastSeen && (
                <time
                  dateTime={row.lastSeen.toISOString()}
                  className="text-muted-foreground ms-auto text-xs tabular-nums"
                >
                  {formatJalaliDateTime(row.lastSeen)}
                </time>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}