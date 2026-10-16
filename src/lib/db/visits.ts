import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "./prisma";

/**
 * Visit analytics persistence.
 *
 * The model is deliberately three-layer, because "a visit" is a human concept
 * that HTTP does not have:
 *
 *   Visitor  — one anonymous browser identity across all time (`vid` cookie).
 *   Session  — one continuous visit; several page views belong to it.
 *   PageView — one page load, with the order preserved.
 *
 * Two writers share `registerPageView`:
 *  - `src/proxy.ts` for document loads (works without JavaScript, catches bots),
 *  - `POST /api/visit` for client-side navigations, which never reach the
 *    proxy as page requests.
 *
 * Raw IP addresses are stored. That is the analysis the owner asked for; the
 * tables are owner-only, behind the admin gate.
 */

/** Inactivity after which the next page view opens a NEW session. */
export const SESSION_GAP_MS = 30 * 60_000;

/** Admin list page size. */
const LIST_PAGE_SIZE = 25;
const EXPORT_MAX_ROWS = 50_000;

/** Hardware specs reported by the browser. Json column so growth is free. */
export type VisitClientSpecs = {
  screen: [number, number];
  viewport: [number, number];
  dpr: number;
  cores?: number | null;
  memoryGb?: number | null;
  timezone?: string | null;
  connection?: string | null;
  touch?: boolean | null;
  colorDepth?: number | null;
  lang?: string | null;
};

/** Everything known about the requester at the moment of a page view. */
export type VisitFacts = {
  ip?: string | null;
  country?: string | null;
  language?: string | null;
  userAgent?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  isBot: boolean;
  owner: boolean;
  client?: VisitClientSpecs | null;
};

/** Resolved identity of a landing, for creating a Visitor row. */
function visitorSeed(visitorId: string, facts: VisitFacts, now: Date) {
  return {
    id: visitorId,
    firstSeen: now,
    lastSeen: now,
    ip: facts.ip ?? null,
    ips: facts.ip ? [facts.ip] : [],
    country: facts.country ?? null,
    language: facts.language ?? null,
    userAgent: facts.userAgent ?? null,
    browser: facts.browser ?? null,
    os: facts.os ?? null,
    device: facts.device ?? null,
    isBot: facts.isBot,
    owner: facts.owner,
    client: (facts.client ?? undefined) as Prisma.InputJsonObject | undefined,
  };
}

/**
 * Records one page view: resolves the visitor, extends their open session or
 * starts a new one, and appends the page to the trail.
 *
 * Best-effort by contract (proxy calls it in `waitUntil`, so a database blip
 * must never surface as a broken page): errors are swallowed and a synthetic
 * id returned so the caller can still hand a cookie to the reporter.
 */
export async function registerPageView(input: {
  visitorId: string | null;
  pageViewId: string;
  sessionId: string;
  path: string;
  referrer?: string | null;
  facts: VisitFacts;
  /** Page view being left behind, with how long it was looked at. */
  closePageViewId?: string | null;
  closeDwellMs?: number | null;
}): Promise<{
  pageViewId: string;
  sessionId: string;
  visitorId: string;
  newVisitor: boolean;
  newSession: boolean;
}> {
  const now = new Date();
  const visitorId = input.visitorId ?? crypto.randomUUID();
  const first = { pageViewId: input.pageViewId, sessionId: input.sessionId };

  try {
    // Close the page the visitor just left (soft navigations only — a document
    // load starts a brand new page anyway).
    if (input.closePageViewId && input.closeDwellMs) {
      await prisma.pageView.updateMany({
        where: { id: input.closePageViewId, dwellMs: null },
        data: { dwellMs: input.closeDwellMs },
      });
    }

    const seen = await prisma.visitor.findUnique({
      where: { id: visitorId },
      select: { id: true },
    });
    const newVisitor = seen === null;

    await prisma.visitor.upsert({
      where: { id: visitorId },
      create: visitorSeed(visitorId, input.facts, now),
      update: {
        lastSeen: now,
        ip: input.facts.ip ?? undefined,
        country: input.facts.country ?? undefined,
        language: input.facts.language ?? undefined,
        userAgent: input.facts.userAgent ?? undefined,
        browser: input.facts.browser ?? undefined,
        os: input.facts.os ?? undefined,
        device: input.facts.device ?? undefined,
        isBot: input.facts.isBot,
        // Sticky: once the owner has browsed with a session, the identity is
        // the owner's for good.
        owner: input.facts.owner ? true : undefined,
        ...(input.facts.client
          ? { client: input.facts.client as Prisma.InputJsonObject }
          : {}),
        ...(input.facts.ip ? { ips: { push: input.facts.ip } } : {}),
      },
    });

    const open = await prisma.visitSession.findFirst({
      where: {
        visitorId,
        lastActivityAt: { gt: new Date(now.getTime() - SESSION_GAP_MS) },
      },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });

    const sessionId = open?.id ?? input.sessionId;
    if (open) {
      await prisma.visitSession.update({
        where: { id: open.id },
        data: {
          lastActivityAt: now,
          exitPath: input.path,
          ...(input.facts.client
            ? { client: input.facts.client as Prisma.InputJsonObject }
            : {}),
        },
      });
    } else {
      await prisma.visitSession.create({
        data: {
          id: input.sessionId,
          visitorId,
          startedAt: now,
          lastActivityAt: now,
          entryPath: input.path,
          exitPath: input.path,
          referrer: input.referrer ?? null,
          ip: input.facts.ip ?? null,
          country: input.facts.country ?? null,
          language: input.facts.language ?? null,
          userAgent: input.facts.userAgent ?? null,
          browser: input.facts.browser ?? null,
          os: input.facts.os ?? null,
          device: input.facts.device ?? null,
          isBot: input.facts.isBot,
          owner: input.facts.owner,
          newVisitor,
          ...(input.facts.client
            ? { client: input.facts.client as Prisma.InputJsonObject }
            : {}),
        },
      });
    }

    await prisma.pageView.create({
      data: { id: input.pageViewId, sessionId, path: input.path, viewedAt: now },
    });

    return {
      pageViewId: input.pageViewId,
      sessionId,
      visitorId,
      newVisitor,
      newSession: !open,
    };
  } catch {
    return { ...first, visitorId, newVisitor: false, newSession: false };
  }
}

/**
 * Attaches what only the browser knows to an existing page view: dwell time
 * (when the visitor moved on) and the hardware specs.
 *
 * Returns false when the row does not exist — a stale cookie, or the proxy's
 * background insert that has not landed yet (the caller retries once).
 */
export async function enrichPageView(
  pageViewId: string,
  data: { dwellMs?: number | null; client?: VisitClientSpecs | null },
): Promise<boolean> {
  try {
    /*
     * Dwell is first-close-out-wins. A page can fire several close-outs
     * (pagehide, then a restored-from-back/forward-cache pagehide again) and
     * the earliest one is the accurate "left the page" moment; letting a
     * later report overwrite it would inflate every repeat view.
     */
    const hasDwell = typeof data.dwellMs === "number" && data.dwellMs > 0;
    const view = await prisma.pageView.updateMany({
      where: hasDwell ? { id: pageViewId, dwellMs: null } : { id: pageViewId },
      data: hasDwell ? { dwellMs: data.dwellMs } : {},
    });
    if (view.count === 0 && !(hasDwell && (await pageViewExists(pageViewId)))) {
      return false;
    }

    const { sessionId, session } = await prisma.pageView.findUniqueOrThrow({
      where: { id: pageViewId },
      select: { sessionId: true, session: { select: { visitorId: true } } },
    });

    if (data.client) {
      const json = data.client as Prisma.InputJsonObject;
      await prisma.visitSession.updateMany({
        where: { id: sessionId },
        data: { client: json },
      });
      await prisma.visitor.updateMany({
        where: { id: session.visitorId },
        data: { client: json },
      });
    }
    return true;
  } catch {
    return false;
  }
}

async function pageViewExists(id: string): Promise<boolean> {
  const row = await prisma.pageView.findUnique({ where: { id }, select: { id: true } });
  return row !== null;
}

// ---------------------------------------------------------------------------
// Section engagement
// ---------------------------------------------------------------------------

/** One section's reading time, as the tracker reports it. */
export type SectionReport = {
  sectionId: string;
  dwellMs: number;
  views: number;
};

/**
 * Stores a page view's section totals.
 *
 * Absolute values, upserted: the tracker re-sends the whole picture on every
 * heartbeat, on navigation, and on unload, so a dropped report can only lose
 * time — it can never double it. Silently ignores unknown page views (stale
 * cookie, proxy insert still in flight), exactly like `enrichPageView`.
 */
export async function upsertSectionDwell(
  pageViewId: string,
  path: string,
  reports: SectionReport[],
): Promise<boolean> {
  if (reports.length === 0) return true;
  try {
    const view = await prisma.pageView.findUnique({
      where: { id: pageViewId },
      select: { id: true },
    });
    if (!view) return false;

    for (const report of reports) {
      const sectionId = report.sectionId.slice(0, 64);
      await prisma.sectionDwell.upsert({
        where: { pageViewId_sectionId: { pageViewId, sectionId } },
        create: {
          pageViewId,
          path: path.slice(0, 500),
          sectionId,
          dwellMs: report.dwellMs,
          views: report.views,
        },
        // Absolute totals, last report wins: heartbeats re-send everything.
        update: {
          dwellMs: Math.max(0, report.dwellMs),
          views: Math.max(1, report.views),
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

export type SectionTotal = {
  sectionId: string;
  dwellMs: number;
  views: number;
  visits: number;
};

/**
 * Aggregate section engagement across sessions, honouring the same filters as
 * the list (`q` matches paths, `scope` human/bot, `ip`). The home-page panel
 * reads this; ordering stays by time spent, which is the ranking the owner
 * actually wants ("they spent their visit in the projects section").
 */
export async function sectionTotals(
  filter: VisitFilter,
  path: string,
): Promise<SectionTotal[]> {
  const scope = sessionWhere(filter);
  const grouped = await prisma.sectionDwell.groupBy({
    by: ["sectionId", "path"],
    where: { path, pageView: { session: scope } },
    _sum: { dwellMs: true, views: true },
    _count: { _all: true },
  });

  return grouped
    .map((row) => ({
      sectionId: row.sectionId,
      dwellMs: row._sum.dwellMs ?? 0,
      views: row._sum.views ?? 0,
      visits: row._count._all,
    }))
    .sort((a, b) => b.dwellMs - a.dwellMs);
}

/** Section breakdown for one session — what this visitor looked at, and for how long. */
export async function sessionSections(sessionId: string): Promise<SectionTotal[]> {
  const rows = await prisma.sectionDwell.findMany({
    where: { pageView: { sessionId } },
    select: { sectionId: true, dwellMs: true, views: true },
  });
  return rows
    .map((row) => ({
      sectionId: row.sectionId,
      dwellMs: row.dwellMs,
      views: row.views,
      visits: 1,
    }))
    .sort((a, b) => b.dwellMs - a.dwellMs);
}

/**
 * Durations, derived rather than stored: time on a page is the gap to the
 * next view (client-reported dwell wins, then the gap, and for the last page
 * the gap to the session's last activity). `null` when genuinely unknown.
 */
export type PageViewWithDwell = {
  id: string;
  path: string;
  viewedAt: Date;
  dwellMs: number | null;
  /** How this duration was arrived at — "reported" or derived from timing. */
  dwellSource: "reported" | "derived" | null;
};

export type SessionRow = {
  id: string;
  visitorId: string;
  startedAt: Date;
  lastActivityAt: Date;
  entryPath: string;
  exitPath: string | null;
  referrer: string | null;
  ip: string | null;
  country: string | null;
  language: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  userAgent: string | null;
  client: Prisma.JsonValue;
  isBot: boolean;
  owner: boolean;
  newVisitor: boolean;
  /** Derived wall-clock duration in ms (lastActivity − started). */
  durationMs: number;
  pageViews: PageViewWithDwell[];
};

export type VisitScope = "all" | "human" | "bot";

export type VisitFilter = {
  q?: string;
  scope?: VisitScope;
  /** Exact address match — the "who came from this office" view. */
  ip?: string;
  visitorId?: string;
};

function sessionWhere(filter: VisitFilter): Prisma.VisitSessionWhereInput {
  const clauses: Prisma.VisitSessionWhereInput[] = [];
  if (filter.q) {
    // Matches any page *in* the session, not just entry/exit: "which visits
    // looked at this project?" is the question a path search is asked, and a
    // project read in the middle of a session is invisible otherwise.
    clauses.push({
      OR: [
        { entryPath: { contains: filter.q } },
        { exitPath: { contains: filter.q } },
        { pageViews: { some: { path: { contains: filter.q } } } },
      ],
    });
  }
  if (filter.scope === "human") clauses.push({ isBot: false });
  if (filter.scope === "bot") clauses.push({ isBot: true });
  if (filter.ip) clauses.push({ ip: filter.ip });
  if (filter.visitorId) clauses.push({ visitorId: filter.visitorId });
  return clauses.length ? { AND: clauses } : {};
}

/**
 * Attaches derived durations to a session's page views. Pure computation —
 * no extra queries — so timelines are populated even for crawlers that never
 * run the beacon.
 */
function withDurations(
  session: {
    startedAt: Date;
    lastActivityAt: Date;
    pageViews: Array<{ id: string; path: string; viewedAt: Date; dwellMs: number | null }>;
  },
): SessionRow["pageViews"] {
  return session.pageViews.map((view, i) => {
    const next = session.pageViews[i + 1];
    const dwellMs =
      view.dwellMs ??
      (next
        ? next.viewedAt.getTime() - view.viewedAt.getTime()
        : session.lastActivityAt.getTime() - view.viewedAt.getTime());
    return {
      id: view.id,
      path: view.path,
      viewedAt: view.viewedAt,
      dwellMs: dwellMs > 0 ? dwellMs : null,
      dwellSource: view.dwellMs != null ? "reported" : dwellMs > 0 ? "derived" : null,
    };
  });
}

const SESSION_SELECT = {
  id: true,
  visitorId: true,
  startedAt: true,
  lastActivityAt: true,
  entryPath: true,
  exitPath: true,
  referrer: true,
  ip: true,
  country: true,
  language: true,
  browser: true,
  os: true,
  device: true,
  userAgent: true,
  client: true,
  isBot: true,
  owner: true,
  newVisitor: true,
} satisfies Prisma.VisitSessionSelect;

function toSessionRow(
  session: Omit<SessionRow, "durationMs" | "pageViews"> & {
    pageViews: Array<{ id: string; path: string; viewedAt: Date; dwellMs: number | null }>;
  },
): SessionRow {
  return {
    ...session,
    durationMs: session.lastActivityAt.getTime() - session.startedAt.getTime(),
    pageViews: withDurations(session),
  };
}

export type VisitStats = {
  sessions: number;
  pageViews: number;
  visitors: number;
  humanSessions: number;
};

export async function visitStats(filter: VisitFilter): Promise<VisitStats> {
  const scope = sessionWhere(filter);
  const [sessions, pageViews, visitors, humanSessions] = await Promise.all([
    prisma.visitSession.count({ where: scope }),
    prisma.pageView.count({ where: { session: scope } }),
    prisma.visitSession.groupBy({
      by: ["visitorId"],
      where: scope,
    }),
    prisma.visitSession.count({ where: { AND: [scope, { isBot: false }] } }),
  ]);
  return { sessions, pageViews, visitors: visitors.length, humanSessions };
}

export type SessionListPage = {
  rows: SessionRow[];
  page: number;
  pageCount: number;
  stats: VisitStats;
};

export async function listSessions(
  filter: VisitFilter,
  page: number,
): Promise<SessionListPage> {
  const scope = sessionWhere(filter);
  const [sessions, total, stats] = await Promise.all([
    prisma.visitSession.findMany({
      where: scope,
      select: {
        ...SESSION_SELECT,
        pageViews: {
          select: { id: true, path: true, viewedAt: true, dwellMs: true },
          orderBy: { viewedAt: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * LIST_PAGE_SIZE,
      take: LIST_PAGE_SIZE,
    }),
    prisma.visitSession.count({ where: scope }),
    visitStats(filter),
  ]);
  return {
    rows: sessions.map(toSessionRow),
    page,
    pageCount: Math.max(1, Math.ceil(total / LIST_PAGE_SIZE)),
    stats,
  };
}

export type SessionDetail = SessionRow & {
  visitor: {
    id: string;
    firstSeen: Date;
    lastSeen: Date;
    ips: string[];
    owner: boolean;
  } | null;
};

export async function getSession(id: string): Promise<SessionDetail | null> {
  const session = await prisma.visitSession.findUnique({
    where: { id },
    select: {
      ...SESSION_SELECT,
      pageViews: {
        select: { id: true, path: true, viewedAt: true, dwellMs: true },
        orderBy: { viewedAt: "asc" },
      },
      visitor: {
        select: { id: true, firstSeen: true, lastSeen: true, ips: true, owner: true },
      },
    },
  });
  if (!session) return null;

  const { visitor, pageViews, ...rest } = session;
  return { ...toSessionRow({ ...rest, pageViews }), visitor };
}

// ---------------------------------------------------------------------------
// Visitors
// ---------------------------------------------------------------------------

export type VisitorRow = {
  id: string;
  firstSeen: Date;
  lastSeen: Date;
  ip: string | null;
  ips: string[];
  country: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  isBot: boolean;
  owner: boolean;
  sessionCount: number;
  pageViewCount: number;
};

export type VisitorListPage = {
  rows: VisitorRow[];
  page: number;
  pageCount: number;
};

export async function listVisitors(
  filter: VisitFilter,
  page: number,
): Promise<VisitorListPage> {
  const clauses: Prisma.VisitorWhereInput[] = [];
  if (filter.q) {
    clauses.push({
      OR: [
        { ip: { contains: filter.q } },
        { userAgent: { contains: filter.q } },
        { browser: { contains: filter.q } },
      ],
    });
  }
  if (filter.ip) clauses.push({ ip: filter.ip });
  if (filter.scope === "human") clauses.push({ isBot: false });
  if (filter.scope === "bot") clauses.push({ isBot: true });
  const scope = clauses.length ? { AND: clauses } : {};

  const [visitors, total] = await Promise.all([
    prisma.visitor.findMany({
      where: scope,
      orderBy: { lastSeen: "desc" },
      skip: (page - 1) * LIST_PAGE_SIZE,
      take: LIST_PAGE_SIZE,
      select: {
        id: true,
        firstSeen: true,
        lastSeen: true,
        ip: true,
        ips: true,
        country: true,
        browser: true,
        os: true,
        device: true,
        isBot: true,
        owner: true,
        _count: { select: { sessions: true } },
      },
    }),
    prisma.visitor.count({ where: scope }),
  ]);

  const ids = visitors.map((v) => v.id);
  const counts = await prisma.pageView.groupBy({
    by: ["sessionId"],
    where: { session: { visitorId: { in: ids } } },
    _count: { _all: true },
  });
  const sessionIds = await prisma.visitSession.findMany({
    where: { visitorId: { in: ids } },
    select: { id: true },
  });
  const visitorOfSession = new Map(
    await prisma.visitSession
      .findMany({ where: { id: { in: sessionIds.map((s) => s.id) } }, select: { id: true, visitorId: true } })
      .then((rows) => rows.map((s) => [s.id, s.visitorId] as const)),
  );
  const pagesByVisitor = new Map<string, number>();
  for (const c of counts) {
    const visitorId = visitorOfSession.get(c.sessionId);
    if (!visitorId) continue;
    pagesByVisitor.set(visitorId, (pagesByVisitor.get(visitorId) ?? 0) + c._count._all);
  }

  return {
    rows: visitors.map((v) => ({
      id: v.id,
      firstSeen: v.firstSeen,
      lastSeen: v.lastSeen,
      ip: v.ip,
      ips: [...new Set(v.ips)],
      country: v.country,
      browser: v.browser,
      os: v.os,
      device: v.device,
      isBot: v.isBot,
      owner: v.owner,
      sessionCount: v._count.sessions,
      pageViewCount: pagesByVisitor.get(v.id) ?? 0,
    })),
    page,
    pageCount: Math.max(1, Math.ceil(total / LIST_PAGE_SIZE)),
  };
}

export type VisitorDetail = {
  id: string;
  firstSeen: Date;
  lastSeen: Date;
  ip: string | null;
  ips: string[];
  country: string | null;
  language: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  isBot: boolean;
  owner: boolean;
  client: Prisma.JsonValue;
  sessions: SessionRow[];
};

export async function getVisitor(id: string): Promise<VisitorDetail | null> {
  const visitor = await prisma.visitor.findUnique({
    where: { id },
    include: {
      sessions: {
        orderBy: { startedAt: "desc" },
        select: {
          ...SESSION_SELECT,
          pageViews: {
            select: { id: true, path: true, viewedAt: true, dwellMs: true },
            orderBy: { viewedAt: "asc" },
          },
        },
      },
    },
  });
  if (!visitor) return null;
  const { sessions, ...rest } = visitor;
  return {
    ...rest,
    ips: [...new Set(rest.ips)],
    sessions: sessions.map(toSessionRow),
  };
}

// ---------------------------------------------------------------------------
// IP overview — "who came out of this address"
// ---------------------------------------------------------------------------

export type IpRow = {
  ip: string;
  country: string | null;
  sessionCount: number;
  visitorCount: number;
  lastSeen: Date | null;
};

export async function listIps(filter: VisitFilter): Promise<IpRow[]> {
  const scope = sessionWhere(filter);
  const byIp = await prisma.visitSession.groupBy({
    by: ["ip", "country"],
    where: { AND: [scope, { ip: { not: null } }] },
    _count: { _all: true },
    _max: { lastActivityAt: true },
  });
  const pairs = await prisma.visitSession.groupBy({
    by: ["ip", "visitorId"],
    where: { AND: [scope, { ip: { not: null } }] },
  });
  const visitorsByIp = new Map<string, Set<string>>();
  for (const p of pairs) {
    if (!p.ip) continue;
    const set = visitorsByIp.get(p.ip) ?? new Set<string>();
    set.add(p.visitorId);
    visitorsByIp.set(p.ip, set);
  }

  return byIp
    .filter((row): row is typeof row & { ip: string } => row.ip !== null)
    .map((row) => ({
      ip: row.ip,
      country: row.country,
      sessionCount: row._count._all,
      visitorCount: visitorsByIp.get(row.ip)?.size ?? 0,
      lastSeen: row._max.lastActivityAt,
    }))
    .sort((a, b) => (b.lastSeen?.getTime() ?? 0) - (a.lastSeen?.getTime() ?? 0));
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function listSessionsForExport(
  filter: VisitFilter,
): Promise<SessionRow[]> {
  const sessions = await prisma.visitSession.findMany({
    where: sessionWhere(filter),
    select: {
      ...SESSION_SELECT,
      pageViews: {
        select: { id: true, path: true, viewedAt: true, dwellMs: true },
        orderBy: { viewedAt: "asc" },
      },
    },
    orderBy: { startedAt: "desc" },
    take: EXPORT_MAX_ROWS,
  });
  return sessions.map(toSessionRow);
}

export type PageViewExportRow = {
  id: string;
  sessionId: string;
  visitorId: string;
  startedAt: Date;
  viewedAt: Date;
  path: string;
  dwellMs: number | null;
  dwellSource: PageViewWithDwell["dwellSource"];
  ip: string | null;
  country: string | null;
  language: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  isBot: boolean;
  owner: boolean;
  newVisitor: boolean;
};

export async function listPageViewsForExport(
  filter: VisitFilter,
): Promise<PageViewExportRow[]> {
  const scope = sessionWhere(filter);
  const views = await prisma.pageView.findMany({
    where: { session: scope },
    orderBy: { viewedAt: "desc" },
    take: EXPORT_MAX_ROWS,
    select: {
      id: true,
      sessionId: true,
      viewedAt: true,
      path: true,
      dwellMs: true,
      session: {
        select: {
          visitorId: true,
          startedAt: true,
          ip: true,
          country: true,
          language: true,
          browser: true,
          os: true,
          device: true,
          isBot: true,
          owner: true,
          newVisitor: true,
          lastActivityAt: true,
        },
      },
    },
  });

  return views
    .map((v) => {
      const [row] = withDurations({
        startedAt: v.session.startedAt,
        lastActivityAt: v.session.lastActivityAt,
        pageViews: [v],
      });
      return {
        id: v.id,
        sessionId: v.sessionId,
        visitorId: v.session.visitorId,
        startedAt: v.session.startedAt,
        viewedAt: v.viewedAt,
        path: v.path,
        dwellMs: row.dwellMs,
        dwellSource: row.dwellSource,
        ip: v.session.ip,
        country: v.session.country,
        language: v.session.language,
        browser: v.session.browser,
        os: v.session.os,
        device: v.session.device,
        isBot: v.session.isBot,
        owner: v.session.owner,
        newVisitor: v.session.newVisitor,
      };
    })
    .sort((a, b) => b.viewedAt.getTime() - a.viewedAt.getTime());
}