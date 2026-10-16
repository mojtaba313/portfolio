import Link from "next/link";

import { fa } from "@/content/fa";
import { AdminPageHeader } from "@/features/admin/components/ui";
import {
  IpBadge,
  SectionBars,
  SessionShape,
  SessionTime,
  SessionTrail,
  SpecsLine,
  VisitBadges,
  VisitFilterForm,
  VisitPagination,
  VisitStatsTiles,
  VisitsTabs,
  hostOf,
} from "@/features/admin/components/visits";
import { sectionLabel } from "@/features/admin/lib/section-labels";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import {
  listSessions,
  sectionTotals,
  type VisitScope,
} from "@/lib/db/visits";

export const metadata = { title: fa.admin.visits };

type SearchParams = Promise<{
  q?: string;
  scope?: string;
  page?: string;
  ip?: string;
}>;

function parseScope(raw: string | undefined): VisitScope {
  return raw === "human" || raw === "bot" ? raw : "all";
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Sessions — one row per *visit*, not per page.
 *
 * Three pages read in a row are three PageViews inside one session, because
 * that grouping is the question this panel exists to answer. The row carries
 * the trail, the shape (pages + duration), and the identity facts (IP, device,
 * badges); every one of them is a link deeper into the history.
 */
export default async function AdminVisitsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();

  const params = await searchParams;
  const q = params.q?.slice(0, 200) ?? "";
  const ip = params.ip?.slice(0, 45) ?? "";
  const scope = parseScope(params.scope);
  const page = parsePage(params.page);

  const filter = { q: q || undefined, ip: ip || undefined, scope };
  const [{ rows, pageCount, stats }, sections] = await Promise.all([
    listSessions(filter, page),
    // Home-page section reading time, under the same filters as the list.
    sectionTotals(filter, "/"),
  ]);

  const filterQuery = new URLSearchParams();
  if (q) filterQuery.set("q", q);
  if (ip) filterQuery.set("ip", ip);
  if (scope !== "all") filterQuery.set("scope", scope);
  const filterQs = filterQuery.toString();

  const pageHref = (target: number) => {
    const p = new URLSearchParams(filterQuery);
    if (target > 1) p.set("page", String(target));
    const qs = p.toString();
    return `/admin/visits${qs ? `?${qs}` : ""}`;
  };

  const exportHref = (what?: "pageviews") =>
    `/admin/visits/export${filterQs ? `?${filterQs}` : ""}${
      what ? `${filterQs ? "&" : "?"}what=${what}` : ""
    }`;

  return (
    <div>
      <AdminPageHeader
        title={fa.admin.visits}
        backHref="/admin"
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={exportHref()}
              className="text-muted-foreground hover:text-foreground rounded-full border border-border/70 px-4 py-1.5 text-sm transition-colors hover:border-primary/50"
            >
              {fa.admin.visitExport}
            </Link>
            <Link
              href={exportHref("pageviews")}
              className="text-muted-foreground hover:text-foreground rounded-full border border-border/70 px-4 py-1.5 text-sm transition-colors hover:border-primary/50"
            >
              {fa.admin.visitExportPages}
            </Link>
          </div>
        }
      />
      <VisitsTabs active="sessions" />

      {ip && (
        <p className="text-muted-foreground mb-6 text-xs">
          {fa.admin.visitIpFilter}: <span dir="ltr" className="font-mono">{ip}</span>
        </p>
      )}

      <VisitStatsTiles stats={stats} />

      {sections.length > 0 && (
        <section className="border-border/70 mb-6 rounded-2xl border p-4">
          <h2 className="text-sm font-medium">{fa.admin.visitSectionReading}</h2>
          <p className="text-muted-foreground mt-1 mb-3 text-xs">
            {fa.admin.visitSectionHint}
          </p>
          <SectionBars sections={sections} labelFor={sectionLabel} />
        </section>
      )}

      <VisitFilterForm
        q={q}
        scope={scope}
        ip={ip || undefined}
        placeholder={fa.admin.visitSearch}
        action="/admin/visits"
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {q || scope !== "all" || ip ? fa.admin.noVisitResults : fa.admin.emptySessions}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((session) => {
            const host = hostOf(session.referrer);
            return (
              <li
                key={session.id}
                className="rounded-2xl border border-border/70 bg-white/[0.02] px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link
                    href={`/admin/visits/${session.id}`}
                    className="hover:text-primary transition-colors"
                  >
                    <SessionTime date={session.startedAt} />
                  </Link>
                  <Link
                    href={`/admin/visits/${session.id}`}
                    className="min-w-0 flex-1"
                  >
                    <SessionTrail session={session} />
                  </Link>
                  <VisitBadges
                    isBot={session.isBot}
                    owner={session.owner}
                    newVisitor={session.newVisitor}
                    singlePage={session.pageViews.length === 1}
                  />
                </div>

                <div className="text-muted-foreground mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                  <SessionShape session={session} />
                  <span dir="ltr">
                    {session.browser} · {session.os} · {session.device}
                  </span>
                  <IpBadge ip={session.ip} country={session.country} />
                  <Link
                    href={`/admin/visits/visitors/${session.visitorId}`}
                    dir="ltr"
                    className="hover:text-primary font-mono text-[11px] transition-colors"
                  >
                    {session.visitorId.slice(0, 8)}
                  </Link>
                  {host && (
                    <span>
                      {fa.admin.visitFrom}{" "}
                      <span dir="ltr" className="font-mono">
                        {host}
                      </span>
                    </span>
                  )}
                </div>

                <SpecsLine client={session.client} className="mt-1" />
              </li>
            );
          })}
        </ul>
      )}

      <VisitPagination page={page} pageCount={pageCount} pageHref={pageHref} />
    </div>
  );
}