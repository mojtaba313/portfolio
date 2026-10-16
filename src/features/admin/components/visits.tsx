import Link from "next/link";

import { fa } from "@/content/fa";
import type { Prisma } from "@/generated/prisma/client";

import type {
  PageViewWithDwell,
  SessionRow,
  VisitScope,
  VisitStats,
} from "@/lib/db/visits";
import { formatDuration, formatJalaliDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for the analytics screens (sessions, visitors, IPs).
 *
 * The vocabulary the owner is reading here is deliberately behavioural rather
 * than infrastructural: a *visit* is a session, a session is a trail of pages,
 * and a person is a visitor whose history spans sessions. Every component here
 * exists to make those three levels legible in Persian, without a chart.
 */

type ClientSpecs = {
  screen?: [number, number];
  dpr?: number;
  cores?: number | null;
  memoryGb?: number | null;
  timezone?: string | null;
  connection?: string | null;
};

/** Sessions / Visitors / IPs — the three questions about a visit. */
export function VisitsTabs({ active }: { active: "sessions" | "visitors" | "ips" }) {
  const tabs = [
    { key: "sessions", href: "/admin/visits", label: fa.admin.visitsTabSessions },
    { key: "visitors", href: "/admin/visits/visitors", label: fa.admin.visitsTabVisitors },
    { key: "ips", href: "/admin/visits/ips", label: fa.admin.visitsTabIps },
  ] as const;

  return (
    <nav aria-label={fa.admin.visits} className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm transition-colors",
            active === tab.key
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border-border/70",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function VisitStatsTiles({ stats }: { stats: VisitStats }) {
  const tiles = [
    { label: fa.admin.visitSessions, value: stats.sessions },
    { label: fa.admin.visitPageViews, value: stats.pageViews },
    { label: fa.admin.visitUniqueVisitors, value: stats.visitors },
    { label: fa.admin.visitHumanSessions, value: stats.humanSessions },
  ];
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-2xl border border-border/70 bg-white/[0.02] px-4 py-3"
        >
          <p className="text-muted-foreground text-xs">{tile.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {tile.value.toLocaleString("fa-IR")}
          </p>
        </div>
      ))}
    </div>
  );
}

export function VisitFilterForm({
  q,
  scope,
  ip,
  placeholder,
  action,
}: {
  q: string;
  scope: VisitScope;
  ip?: string;
  placeholder: string;
  action: string;
}) {
  return (
    <form method="get" action={action} className="mb-6 flex flex-wrap items-center gap-2">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="border-border/70 bg-white/[0.03] focus:border-primary/60 h-10 w-full rounded-xl border px-4 text-sm outline-none sm:w-56"
      />
      {ip && <input type="hidden" name="ip" value={ip} />}
      <select
        name="scope"
        defaultValue={scope}
        className="border-border/70 bg-white/[0.03] focus:border-primary/60 h-10 rounded-xl border px-3 text-sm outline-none"
      >
        <option value="all">{fa.admin.visitScopeAll}</option>
        <option value="human">{fa.admin.visitScopeHuman}</option>
        <option value="bot">{fa.admin.visitScopeBot}</option>
      </select>
      <button
        type="submit"
        className="bg-primary text-primary-foreground h-10 rounded-xl px-5 text-sm font-medium transition-opacity hover:opacity-90"
      >
        {fa.admin.visitApply}
      </button>
    </form>
  );
}

export function VisitPagination({
  page,
  pageCount,
  pageHref,
}: {
  page: number;
  pageCount: number;
  pageHref: (target: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-between text-sm">
      <span className="text-muted-foreground tabular-nums" dir="ltr">
        {page} / {pageCount}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={pageHref(page - 1)}
            className="text-muted-foreground hover:text-foreground rounded-full border border-border/70 px-4 py-1.5 transition-colors"
          >
            {fa.admin.visitNewer}
          </Link>
        )}
        {page < pageCount && (
          <Link
            href={pageHref(page + 1)}
            className="text-muted-foreground hover:text-foreground rounded-full border border-border/70 px-4 py-1.5 transition-colors"
          >
            {fa.admin.visitOlder}
          </Link>
        )}
      </div>
    </nav>
  );
}

/** Bot / owner / first-time / single-page — the four labels that change reading. */
export function VisitBadges({
  isBot,
  owner,
  newVisitor,
  singlePage,
}: {
  isBot?: boolean;
  owner?: boolean;
  newVisitor?: boolean;
  singlePage?: boolean;
}) {
  return (
    <>
      {isBot && (
        <span className="rounded-full border border-amber-500/30 px-2.5 py-0.5 font-mono text-[11px] text-amber-400">
          {fa.admin.visitBotBadge}
        </span>
      )}
      {owner && (
        <span className="rounded-full border border-primary/40 px-2.5 py-0.5 text-[11px] text-primary">
          {fa.admin.visitOwnerBadge}
        </span>
      )}
      {newVisitor && (
        <span className="rounded-full border border-emerald-500/30 px-2.5 py-0.5 text-[11px] text-emerald-400">
          {fa.admin.visitNewBadge}
        </span>
      )}
      {singlePage && (
        <span className="text-muted-foreground rounded-full border border-border/70 px-2.5 py-0.5 text-[11px]">
          {fa.admin.visitBounceBadge}
        </span>
      )}
    </>
  );
}

/** Hardware specs, one line, LTR numbers with Persian unit words. */
export function SpecsLine({
  client,
  className,
}: {
  client: Prisma.JsonValue | null | undefined;
  className?: string;
}) {
  const specs = (client ?? null) as Partial<ClientSpecs> | null;
  if (!specs || !specs.screen) {
    return (
      <p className={cn("text-muted-foreground/50 text-[11px]", className)}>
        {fa.admin.visitNoSpecs}
      </p>
    );
  }
  return (
    <p dir="ltr" className={cn("text-muted-foreground/70 truncate text-[11px]", className)}>
      {specs.screen[0]}×{specs.screen[1]}
      {specs.dpr ? ` @${specs.dpr}×` : ""}
      {specs.cores ? ` · ${specs.cores} ${fa.admin.visitCores}` : ""}
      {specs.memoryGb ? ` · ${specs.memoryGb} GB` : ""}
      {specs.connection ? ` · ${specs.connection}` : ""}
      {specs.timezone ? ` · ${specs.timezone}` : ""}
    </p>
  );
}

/**
 * The path a session walked through the site, in order, deduplicated
 * consecutively: "/ → /projects/a → /projects/b" tells the story of the visit
 * in one glance. Each stop links to that page's own analytics later if needed;
 * here it is read, not clicked, so it stays plain text.
 */
export function SessionTrail({ session }: { session: SessionRow }) {
  const stops = session.pageViews
    .map((view) => view.path)
    .filter((path, i, all) => i === 0 || path !== all[i - 1]);
  if (stops.length === 0) return <span dir="ltr">{session.entryPath}</span>;
  return (
    <span dir="ltr" className="min-w-0 truncate font-mono text-sm">
      {stops.join("  →  ")}
    </span>
  );
}

/** "۳ صفحه · ۲ دقیقه و ۱۰ ثانیه" — the shape of a visit at a glance. */
export function SessionShape({ session }: { session: SessionRow }) {
  return (
    <span className="text-muted-foreground text-xs whitespace-nowrap">
      {session.pageViews.length.toLocaleString("fa-IR")} {fa.admin.visitPages}
      {" · "}
      {formatDuration(session.durationMs)}
    </span>
  );
}

export function SessionTime({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} className="text-muted-foreground text-xs tabular-nums">
      {formatJalaliDateTime(date)}
    </time>
  );
}

/**
 * The dwell timeline of one session — one row per page, in visit order, with a
 * bar proportional to how long the page held attention. It is the closest
 * thing to a video scrubber that server-rendered data allows, and it is the
 * fastest way to see "they read this project's case study for two minutes".
 */
export function DwellTimeline({
  views,
}: {
  views: PageViewWithDwell[];
}) {
  const max = Math.max(...views.map((v) => v.dwellMs ?? 0), 1);
  return (
    <ol className="space-y-1.5">
      {views.map((view, i) => {
        const ratio = (view.dwellMs ?? 0) / max;
        return (
          <li key={view.id} className="flex items-center gap-3">
            <span className="text-muted-foreground w-16 shrink-0 text-xs tabular-nums">
              {i + 1}
            </span>
            <span dir="ltr" className="w-40 shrink-0 truncate font-mono text-xs sm:w-64">
              {view.path}
            </span>
            <span className="bg-muted/40 h-2 flex-1 overflow-hidden rounded-full">
              <span
                className="bg-primary/70 block h-full rounded-full"
                style={{ width: `${Math.max(2, Math.round(ratio * 100))}%` }}
              />
            </span>
            <span className="text-muted-foreground w-28 shrink-0 text-xs tabular-nums">
              {view.dwellMs ? formatDuration(view.dwellMs) : "—"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The visitor's address, always labelled. Analytics questions start here —
 * "who was that, from where" — so it gets a first-class chip rather than one
 * more muted detail in a list of facts.
 */
export function IpBadge({
  ip,
  country,
  className,
}: {
  ip: string | null;
  country?: string | null;
  className?: string;
}) {
  if (!ip) return null;
  return (
    <Link
      href={`/admin/visits?ip=${encodeURIComponent(ip)}`}
      dir="ltr"
      title={fa.admin.visitIpFilter}
      className={cn(
        "border-border/70 text-foreground hover:border-primary/50 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors",
        className,
      )}
    >
      <span className="text-muted-foreground font-sans">IP</span>
      {ip}
      {country ? <span className="text-muted-foreground">{country}</span> : null}
    </Link>
  );
}

/**
 * Reading time per section, as labelled bars.
 *
 * `totalMs` scales the bars so the longest section fills the row; the
 * percentage beside each is the number to reason with ("70% of their time went
 * into the projects section"). Used both for the whole-site aggregate and for a
 * single session's breakdown — same shape, different scope.
 */
export function SectionBars({
  sections,
  labelFor,
}: {
  sections: Array<{ sectionId: string; dwellMs: number; views: number }>;
  labelFor: (sectionId: string) => string;
}) {
  const total = sections.reduce((sum, section) => sum + section.dwellMs, 0);
  const max = Math.max(...sections.map((section) => section.dwellMs), 1);

  return (
    <ul className="space-y-2">
      {sections.map((section) => (
        <li key={section.sectionId} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs">{labelFor(section.sectionId)}</span>
          <span className="bg-muted/40 h-2 flex-1 overflow-hidden rounded-full">
            <span
              className="bg-primary/70 block h-full rounded-full"
              style={{ width: `${Math.max(2, Math.round((section.dwellMs / max) * 100))}%` }}
            />
          </span>
          <span className="text-muted-foreground w-28 shrink-0 text-left text-xs tabular-nums">
            {formatDuration(section.dwellMs)}
            {total > 0 && (
              <span className="text-muted-foreground/70 ms-1">
                {Math.round((section.dwellMs / total) * 100).toLocaleString("fa-IR")}٪
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function hostOf(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).host;
  } catch {
    return null;
  }
}