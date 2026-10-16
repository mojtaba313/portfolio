import Link from "next/link";

import { fa } from "@/content/fa";
import { AdminPageHeader } from "@/features/admin/components/ui";
import {
  DwellTimeline,
  IpBadge,
  SectionBars,
  SessionShape,
  SessionTime,
  SpecsLine,
  VisitBadges,
  VisitsTabs,
  hostOf,
} from "@/features/admin/components/visits";
import { sectionLabel } from "@/features/admin/lib/section-labels";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import { getSession, sessionSections } from "@/lib/db/visits";
import { formatDuration } from "@/lib/format-date";

export const metadata = { title: fa.admin.sessionDetail };

/**
 * One visit, in full: who, from where, what they walked through, and how long
 * each page held them. The dwell timeline is the behavioural payload — the
 * difference between "opened the case study" and "read the case study".
 */
export default async function AdminSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const session = await getSession(id);

  if (!session) {
    return (
      <div>
        <AdminPageHeader title={fa.admin.sessionDetail} backHref="/admin/visits" />
        <p className="text-muted-foreground text-sm">{fa.admin.noVisitResults}</p>
      </div>
    );
  }

  const sections = await sessionSections(session.id);
  const host = hostOf(session.referrer);
  const dash = <span className="text-muted-foreground">—</span>;
  const facts: Array<[string, React.ReactNode]> = [
    [
      fa.admin.visitPages,
      <span key="pages">
        {session.pageViews.length.toLocaleString("fa-IR")} {fa.admin.visitPages}
      </span>,
    ],
    [
      fa.admin.visitDuration,
      <span key="d">{formatDuration(session.durationMs)}</span>,
    ],
    [
      fa.admin.visitEntry,
      <span key="e" dir="ltr" className="font-mono text-xs">
        {session.entryPath}
      </span>,
    ],
    ...(session.exitPath && session.exitPath !== session.entryPath
      ? [
          [
            fa.admin.visitExit,
            <span key="x" dir="ltr" className="font-mono text-xs">
              {session.exitPath}
            </span>,
          ] as [string, React.ReactNode],
        ]
      : []),
    [
      fa.admin.visitEntryFrom,
      host ? (
        <span key="r" dir="ltr" className="font-mono text-xs">
          {host}
        </span>
      ) : (
        <span key="r">{dash}</span>
      ),
    ],
    ["IP", <IpBadge key="ip" ip={session.ip} country={session.country} />],
    [
      fa.admin.visitUniqueVisitors,
      session.visitor ? (
        <Link
          key="v"
          href={`/admin/visits/visitors/${session.visitor.id}`}
          dir="ltr"
          className="font-mono text-xs hover:text-primary"
        >
          {session.visitor.id.slice(0, 8)}
        </Link>
      ) : (
        <span key="v">{dash}</span>
      ),
    ],
    [
      fa.admin.visitTrail,
      <span key="ua" dir="ltr" className="text-xs">
        {session.browser} · {session.os} · {session.device}
        {session.language ? ` · ${session.language}` : ""}
      </span>,
    ],
  ];

  return (
    <div>
      <AdminPageHeader
        title={fa.admin.sessionDetail}
        backHref="/admin/visits"
        action={<SessionTime date={session.startedAt} />}
      />
      <VisitsTabs active="sessions" />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <VisitBadges
          isBot={session.isBot}
          owner={session.owner}
          newVisitor={session.newVisitor}
          singlePage={session.pageViews.length === 1}
        />
        <SessionShape session={session} />
      </div>

      <dl className="border-border/70 mb-8 divide-y rounded-2xl border">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-4 px-4 py-2.5">
            <dt className="text-muted-foreground w-36 shrink-0 text-xs">{label}</dt>
            <dd className="min-w-0 flex-1 text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      {sections.length > 0 && (
        <section className="border-border/70 mb-8 rounded-2xl border p-4">
          <h2 className="mb-3 text-sm font-medium">{fa.admin.visitSessionSections}</h2>
          <SectionBars sections={sections} labelFor={sectionLabel} />
        </section>
      )}

      <h2 className="mb-3 text-sm font-medium">{fa.admin.visitTimeline}</h2>
      {session.pageViews.length === 0 ? (
        <p className="text-muted-foreground text-sm">{fa.admin.visitNoTimeline}</p>
      ) : (
        <DwellTimeline views={session.pageViews} />
      )}

      <div className="mt-6">
        <SpecsLine client={session.client} />
        {session.userAgent && (
          <p dir="ltr" className="text-muted-foreground/60 mt-1 text-[11px]">
            {session.userAgent}
          </p>
        )}
      </div>
    </div>
  );
}