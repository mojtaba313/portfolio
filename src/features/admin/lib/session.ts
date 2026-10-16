/**
 * Admin session, without dependencies.
 *
 * The cookie value is `<expiry>.<hmac>`, where the HMAC is keyed by the admin
 * password itself — one env var, no secret to rotate separately. Everything
 * here uses Web Crypto only, so the same functions run in Middleware (Edge)
 * and in Server Actions (Node). No `node:crypto` anywhere in this file.
 */

const COOKIE_NAME = "admin-auth";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function adminCookieName(): string {
  return COOKIE_NAME;
}

export function sessionMaxAgeSeconds(): number {
  return SESSION_TTL_MS / 1000;
}

/** Server-only password. Null when unconfigured — then nobody gets in. */
export function getAdminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

async function hmacHex(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(data),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Fresh signed session value for a successful login. */
export async function createSessionValue(password: string): Promise<string> {
  const expiry = String(Date.now() + SESSION_TTL_MS);
  return `${expiry}.${await hmacHex(password, expiry)}`;
}

/**
 * Validates a session cookie value: shape, signature (constant-time), expiry.
 * Any failure — including an unconfigured password — reads as signed-out.
 */
export async function verifySessionValue(
  value: string | undefined,
  password: string | null,
): Promise<boolean> {
  if (!value || !password) return false;
  const [expiry, signature] = value.split(".");
  if (!expiry || !signature || !/^\d+$/.test(expiry)) return false;
  if (Number(expiry) < Date.now()) return false;
  const expected = await hmacHex(password, expiry);
  if (signature.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
