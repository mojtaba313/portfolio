"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  adminCookieName,
  createSessionValue,
  getAdminPassword,
  sessionMaxAgeSeconds,
} from "./lib/session";

export type LoginState = { error?: string };

/**
 * Password login for the single owner.
 *
 * Comparison runs over SHA-256 digests with `timingSafeEqual` so the check
 * itself leaks nothing about prefix matches. On success the response carries
 * a signed httpOnly cookie (see `./lib/session`); the proxy validates
 * it on every `/admin` request, so this action never needs to "remember"
 * anything server-side.
 */
export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const configured = getAdminPassword();
  if (!configured) {
    return { error: "ورود مدیر تنظیم نشده است — ADMIN_PASSWORD را در env بگذارید." };
  }

  const attempt = String(formData.get("password") ?? "");
  const a = createHash("sha256").update(attempt).digest();
  const b = createHash("sha256").update(configured).digest();
  if (!timingSafeEqual(a, b)) {
    return { error: "گذرواژه اشتباه است." };
  }

  const value = await createSessionValue(configured);
  (await cookies()).set(adminCookieName(), value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(adminCookieName());
  redirect("/admin/login");
}
