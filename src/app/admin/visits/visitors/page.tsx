import Link from "next/link";

import { fa } from "@/content/fa";
import { AdminPageHeader } from "@/features/admin/components/ui";
import {
  VisitBadges,
  VisitFilterForm,
  VisitPagination,
  VisitsTabs,
} from "@/features/admin/components/visits";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import { listVisitors, type VisitScope } from "@/lib/db/visits";
import { formatJalaliDateTime } from "@/lib/format-date";

export const metadata = { title: fa.admin.visitsTabVisitors };

type SearchParams = Promise<{ q?: string; scope?: string; page?: string }>;

function parseScope(raw: string | undefined): VisitScope {
  return raw === "human" || raw === "bot" ? raw : "all";
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Visitors — one row per anonymous identity, across all time.
 *
 * This is the "was it the same person?" level: sessions under one `vid`
 * cookie. When an employer and a CEO browse from one office network they share
 * the IP (see the IPs tab) but not the identity, which is exactly the split
 * that matters when reading their behaviour.
 */
export default async function AdminVisitorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();

  const params = await searchParams;
  const q = params.q?.slice(0, 200) ?? "";
  const scope = parseScope(params.scope);
  const page = parsePage(params.page);

  const { rows, pageCount } = await listVisitors(
    { q: q || undefined, scope },
    page,
  );

  const pageHref = (target: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (scope !== "all") p.set("scope", scope);
    if (target > 1) p.set("page", String(target));
    const qs = p.toString();
    return `/admin/visits/visitors${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <AdminPageHeader title={fa.admin.visitsTabVisitors} backHref="/admin" />
      <VisitsTabs active="visitors" />

      <VisitFilterForm
        q={q}
        scope={scope}
        placeholder={fa.admin.visitSearchVisitor}
        action="/admin/visits/visitors"
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {q || scope !== "all" ? fa.admin.noVisitResults : fa.admin.emptyVisitors}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((visitor) => (
            <li
              key={visitor.id}
              className="rounded-2xl border border-border/70 bg-white/[0.02] px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link
                  href={`/admin/visits/visitors/${visitor.id}`}
                  dir="ltr"
                  className="text-muted-foreground hover:text-primary font-mono text-xs transition-colors"
                >
                  {visitor.id.slice(0, 8)}
                </Link>
                {visitor.ips[0] && (
                  <span dir="ltr" className="font-mono text-xs">
                    {visitor.ips[0]}
                  </span>
                )}
                <span className="text-muted-foreground text-xs">
                  {visitor.sessionCount.toLocaleString("fa-IR")}{" "}
                  {fa.admin.visitSessions2} ·{" "}
                  {visitor.pageViewCount.toLocaleString("fa-IR")}{" "}
                  {fa.admin.visitPages}
                </span>
                <VisitBadges isBot={visitor.isBot} owner={visitor.owner} />
              </div>

              <div className="text-muted-foreground mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                <span>
                  {fa.admin.visitLastSeen}:{" "}
                  <time dateTime={visitor.lastSeen.toISOString()}>
                    {formatJalaliDateTime(visitor.lastSeen)}
                  </time>
                </span>
                <span>
                  {fa.admin.visitFirstSeen}:{" "}
                  <time dateTime={visitor.firstSeen.toISOString()}>
                    {formatJalaliDateTime(visitor.firstSeen)}
                  </time>
                </span>
                <span dir="ltr">
                  {visitor.browser} · {visitor.os} · {visitor.device}
                </span>
              </div>

              {visitor.ips.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {visitor.ips.map((ip) => (
                    <Link
                      key={ip}
                      href={`/admin/visits?ip=${encodeURIComponent(ip)}`}
                      dir="ltr"
                      className="text-muted-foreground hover:text-primary rounded-full border border-border/70 px-2.5 py-0.5 font-mono text-[11px] transition-colors"
                    >
                      {ip}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <VisitPagination page={page} pageCount={pageCount} pageHref={pageHref} />
    </div>
  );
}