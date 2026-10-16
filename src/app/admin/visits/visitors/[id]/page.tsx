import Link from "next/link";

import { fa } from "@/content/fa";
import { AdminPageHeader } from "@/features/admin/components/ui";
import {
  SessionShape,
  SessionTime,
  SessionTrail,
  SpecsLine,
  VisitBadges,
  VisitsTabs,
} from "@/features/admin/components/visits";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import { getVisitor } from "@/lib/db/visits";
import { formatJalaliDateTime } from "@/lib/format-date";

export const metadata = { title: fa.admin.visitorHistory };

/**
 * One identity's whole story, oldest session at the bottom: every visit they
 * ever made, with the pages each one walked. This is the page that answers
 * "have I seen this person before, and what do they care about?" — the
 * employer who keeps coming back to one project is visible here and nowhere
 * else.
 */
export default async function AdminVisitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const visitor = await getVisitor(id);

  if (!visitor) {
    return (
      <div>
        <AdminPageHeader title={fa.admin.visitorHistory} backHref="/admin/visits/visitors" />
        <p className="text-muted-foreground text-sm">{fa.admin.noVisitResults}</p>
      </div>
    );
  }

  const totalPages = visitor.sessions.reduce((n, s) => n + s.pageViews.length, 0);
  const totalDwell = visitor.sessions.reduce(
    (n, s) => n + s.pageViews.reduce((m, v) => m + (v.dwellMs ?? 0), 0),
    0,
  );

  return (
    <div>
      <AdminPageHeader title={fa.admin.visitorHistory} backHref="/admin/visits/visitors" />
      <VisitsTabs active="visitors" />

      <dl className="border-border/70 mb-8 divide-y rounded-2xl border">
        {(
          [
            [
              "ID",
              <span key="id" dir="ltr" className="font-mono text-xs">
                {visitor.id}
              </span>,
            ],
            [
              fa.admin.visitFirstSeen,
              <time key="f" dateTime={visitor.firstSeen.toISOString()} className="text-sm">
                {formatJalaliDateTime(visitor.firstSeen)}
              </time>,
            ],
            [
              fa.admin.visitLastSeen,
              <time key="l" dateTime={visitor.lastSeen.toISOString()} className="text-sm">
                {formatJalaliDateTime(visitor.lastSeen)}
              </time>,
            ],
            [
              fa.admin.visitSessions2,
              <span key="s" className="text-sm tabular-nums">
                {visitor.sessions.length.toLocaleString("fa-IR")}
              </span>,
            ],
            [
              fa.admin.visitPages,
              <span key="p" className="text-sm tabular-nums">
                {totalPages.toLocaleString("fa-IR")}
              </span>,
            ],
            [
              fa.admin.visitDwell,
              <span key="d" className="text-sm tabular-nums">
                {Math.round(totalDwell / 1000).toLocaleString("fa-IR")} ثانیه
              </span>,
            ],
            [
              fa.admin.visitTrail,
              <span key="ua" dir="ltr" className="text-xs">
                {visitor.browser} · {visitor.os} · {visitor.device}
                {visitor.language ? ` · ${visitor.language}` : ""}
              </span>,
            ],
          ] as Array<[string, React.ReactNode]>
        ).map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-4 px-4 py-2.5">
            <dt className="text-muted-foreground w-36 shrink-0 text-xs">{label}</dt>
            <dd className="min-w-0 flex-1">{value}</dd>
          </div>
        ))}
        <div className="flex items-baseline gap-4 px-4 py-2.5">
          <dt className="text-muted-foreground w-36 shrink-0 text-xs">IP</dt>
          <dd className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {visitor.ips.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              visitor.ips.map((ip) => (
                <Link
                  key={ip}
                  href={`/admin/visits?ip=${encodeURIComponent(ip)}`}
                  dir="ltr"
                  className="hover:text-primary rounded-full border border-border/70 px-2.5 py-0.5 font-mono text-[11px] transition-colors"
                >
                  {ip}
                </Link>
              ))
            )}
          </dd>
        </div>
      </dl>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <VisitBadges isBot={visitor.isBot} owner={visitor.owner} />
        <SpecsLine client={visitor.client} />
      </div>

      <h2 className="mb-3 text-sm font-medium">
        {fa.admin.visitSessions2} ({visitor.sessions.length.toLocaleString("fa-IR")})
      </h2>
      {visitor.sessions.length === 0 ? (
        <p className="text-muted-foreground text-sm">{fa.admin.noVisitResults}</p>
      ) : (
        <ul className="space-y-2">
          {visitor.sessions.map((session) => (
            <li
              key={session.id}
              className="rounded-2xl border border-border/70 bg-white/[0.02] px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link href={`/admin/visits/${session.id}`} className="hover:text-primary">
                  <SessionTime date={session.startedAt} />
                </Link>
                <Link href={`/admin/visits/${session.id}`} className="min-w-0 flex-1">
                  <SessionTrail session={session} />
                </Link>
                <VisitBadges isBot={session.isBot} newVisitor={session.newVisitor} />
              </div>
              <div className="text-muted-foreground mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                <SessionShape session={session} />
                {session.ip && (
                  <span dir="ltr" className="font-mono">
                    {session.ip}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}