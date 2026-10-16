import type { NextRequest } from "next/server";

/**
 * Request metadata shared by the two visit writers: `src/proxy.ts` (document
 * loads) and `POST /api/visit` (soft navigations). Kept in one place so a
 * visitor's IP or language cannot mean different things depending on which
 * kind of page view they happened to produce.
 */

/**
 * Client IP as the deployment sees it: nginx terminates TLS and appends the
 * real peer address to `x-forwarded-for`, so only the first entry is trusted —
 * the rest are whatever the client chose to claim.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const candidate =
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    null;
  // IPv6 addresses are at most 45 characters; anything longer is garbage.
  return candidate && candidate.length <= 45 ? candidate : null;
}

/**
 * Country from an edge CDN header when one exists (Cloudflare, Vercel, …).
 * A direct VPS hit has none — null is the honest answer, not "unknown".
 */
export function edgeCountry(headers: Headers): string | null {
  const raw =
    headers.get("cf-ipcountry") ??
    headers.get("x-vercel-ip-country") ??
    headers.get("x-country-code");
  return raw && /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null;
}

/** First tag of Accept-Language, e.g. "fa-IR". */
export function firstLanguageTag(headers: Headers): string | null {
  const first = headers.get("accept-language")?.split(",")[0]?.split(";")[0]?.trim();
  return first ? first.slice(0, 35) : null;
}

/** Null-trimming slice, for bounding hostile header values in the database. */
export function clipHeader(value: string | null, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Secure cookies behind TLS. Neither Next nor this code terminates TLS —
 * nginx does — so both the request URL and `x-forwarded-proto` count.
 */
export function isHttps(request: NextRequest): boolean {
  return (
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https"
  );
}
