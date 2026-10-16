import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  adminCookieName,
  getAdminPassword,
  verifySessionValue,
} from "./session";

/**
 * Call at the top of every admin Server Action and admin data read.
 *
 * The proxy is the outer gate, but actions are directly invocable — so each
 * one verifies the signed session itself rather than trusting the route it
 * was called from. Redirects to login on failure, exactly like the
 * proxy does.
 */
export async function requireAdmin(): Promise<void> {
  const ok = await verifySessionValue(
    (await cookies()).get(adminCookieName())?.value,
    getAdminPassword(),
  );
  if (!ok) redirect("/admin/login");
}
