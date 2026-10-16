import { NextResponse, type NextRequest } from "next/server";

import {
  adminCookieName,
  getAdminPassword,
  verifySessionValue,
} from "@/features/admin/lib/session";

/**
 * Password gate for the admin area.
 *
 * Next 16 renames the `middleware` file convention to `proxy` (the old name is
 * deprecated); the gate is unchanged, it just moved with the convention.
 *
 * `/admin/login` is the only public route under `/admin`; everything else
 * needs a valid signed session cookie (see `features/admin/lib/session`).
 * Stateless by design: no session table, nothing to clean up — an expired
 * or forged cookie simply reads as signed-out and bounces to login.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  const ok = await verifySessionValue(
    request.cookies.get(adminCookieName())?.value,
    getAdminPassword(),
  );
  if (ok) return NextResponse.next();

  const login = request.nextUrl.clone();
  login.pathname = "/admin/login";
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*"],
};
