import type { PageViewExportRow, SessionRow } from "@/lib/db/visits";
import type { Prisma } from "@/generated/prisma/client";

/**
 * CSV serialisation for the visit analytics export.
 *
 * Every field is quoted (RFC 4180) because paths, referrers, and user agents
 * routinely contain commas, quotes, and newlines — an unquoted export would
 * silently corrupt rows in Excel and in scripts alike. Rows are written with
 * CRLF endings for the same reason: that is what spreadsheet software expects.
 *
 * The hardware specs are flattened into scalar columns rather than a JSON
 * blob column, because the point of the export is analysis — pivot tables do
 * not read JSON.
 */

type ClientSpecs = {
  screen?: [number, number];
  viewport?: [number, number];
  dpr?: number;
  cores?: number | null;
  memoryGb?: number | null;
  timezone?: string | null;
  connection?: string | null;
  touch?: boolean | null;
  colorDepth?: number | null;
  lang?: string | null;
};

function cell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function row(values: unknown[]): string {
  return values.map(cell).join(",");
}

function specsOf(client: Prisma.JsonValue | undefined | null): Partial<ClientSpecs> {
  return (client ?? null) as Partial<ClientSpecs> | null ?? {};
}

/** One row per session — a "visit" in the human sense. */
export function sessionsToCsv(rows: SessionRow[]): string {
  const lines = [
    row([
      "session_id",
      "visitor_id",
      "started_at",
      "last_activity_at",
      "duration_s",
      "page_views",
      "trail",
      "entry_path",
      "exit_path",
      "referrer",
      "ip",
      "country",
      "language",
      "browser",
      "os",
      "device",
      "is_bot",
      "owner",
      "new_visitor",
      "single_page",
      "screen_w",
      "screen_h",
      "dpr",
      "cores",
      "memory_gb",
      "timezone",
      "connection",
      "touch",
      "user_agent",
    ]),
  ];

  for (const s of rows) {
    const specs = specsOf(s.client);
    lines.push(
      row([
        s.id,
        s.visitorId,
        s.startedAt.toISOString(),
        s.lastActivityAt.toISOString(),
        Math.round(s.durationMs / 1000),
        s.pageViews.length,
        s.pageViews.map((v) => v.path).join(" → "),
        s.entryPath,
        s.exitPath,
        s.referrer,
        s.ip,
        s.country,
        s.language,
        s.browser,
        s.os,
        s.device,
        s.isBot,
        s.owner,
        s.newVisitor,
        s.pageViews.length === 1,
        specs.screen?.[0],
        specs.screen?.[1],
        specs.dpr,
        specs.cores,
        specs.memoryGb,
        specs.timezone,
        specs.connection,
        specs.touch,
        s.userAgent,
      ]),
    );
  }

  return lines.join("\r\n");
}

/** One row per page — the finest grain, with the dwell that makes it useful. */
export function pageViewsToCsv(rows: PageViewExportRow[]): string {
  const lines = [
    row([
      "page_view_id",
      "session_id",
      "visitor_id",
      "session_started_at",
      "viewed_at",
      "path",
      "dwell_ms",
      "dwell_source",
      "ip",
      "country",
      "language",
      "browser",
      "os",
      "device",
      "is_bot",
      "owner",
      "new_visitor",
    ]),
  ];

  for (const v of rows) {
    lines.push(
      row([
        v.id,
        v.sessionId,
        v.visitorId,
        v.startedAt.toISOString(),
        v.viewedAt.toISOString(),
        v.path,
        v.dwellMs,
        v.dwellSource,
        v.ip,
        v.country,
        v.language,
        v.browser,
        v.os,
        v.device,
        v.isBot,
        v.owner,
        v.newVisitor,
      ]),
    );
  }

  return lines.join("\r\n");
}