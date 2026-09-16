import { createHash } from "node:crypto";

import { prisma } from "./prisma";
import type { ContactData } from "@/lib/validation/contact";

/**
 * Contact message persistence and abuse limiting.
 */

/** Window and cap for the per-sender limit. */
const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_PER_IP = 5;
const RATE_LIMIT_MAX_PER_EMAIL = 3;

/**
 * Salted hash of a client IP.
 *
 * Rate limiting only needs to recognise a repeat sender, so the raw address is
 * never stored — that would be collecting personal data the feature does not
 * need. The salt makes the hashes useless outside this deployment: without it, a
 * leaked table could be checked against the small IPv4 space by brute force.
 *
 * Falls back to a fixed salt only so local development works without extra
 * setup; production must set CONTACT_IP_SALT.
 */
function hashIp(ip: string): string {
  const salt = process.env.CONTACT_IP_SALT ?? "dev-only-unsalted";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; scope: "ip" | "email" };

/**
 * Checks whether this sender has already submitted too much.
 *
 * Two independent limits: one per IP so a single machine cannot flood, and a
 * tighter one per contact handle (email address or phone number — the form
 * accepts either, stored in the `email` column) so rotating IPs does not
 * defeat it. Both read the composite indexes declared on ContactMessage.
 *
 * Counting rows in a time window rather than a token bucket in memory: the VPS
 * runs a single Next process today, but an in-memory counter would silently stop
 * working the moment it runs two, and Postgres is already the source of truth.
 */
export async function checkRateLimit(input: {
  ip: string | null;
  email: string;
}): Promise<RateLimitVerdict> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000);

  if (input.ip) {
    const fromIp = await prisma.contactMessage.count({
      where: { ipHash: hashIp(input.ip), createdAt: { gte: since } },
    });
    if (fromIp >= RATE_LIMIT_MAX_PER_IP) {
      return { allowed: false, scope: "ip" };
    }
  }

  const fromEmail = await prisma.contactMessage.count({
    where: { email: input.email, createdAt: { gte: since } },
  });
  if (fromEmail >= RATE_LIMIT_MAX_PER_EMAIL) {
    return { allowed: false, scope: "email" };
  }

  return { allowed: true };
}

/**
 * Records a submission with PENDING delivery status.
 *
 * Called **before** the email is sent, which is the whole point: if Resend is
 * down or the API key has expired, the message is already durable and shows up
 * in the database with a FAILED status and the provider's reason. A submission
 * is never lost to a delivery fault.
 */
export async function createContactMessage(input: {
  data: ContactData;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ id: string }> {
  const { data, ip, userAgent } = input;

  return prisma.contactMessage.create({
    data: {
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      ipHash: ip ? hashIp(ip) : null,
      // Truncated because a UA header is attacker-controlled and unbounded;
      // there is no reason to store more than enough to identify a client.
      userAgent: userAgent?.slice(0, 300) ?? null,
    },
    select: { id: true },
  });
}

/** Marks a message as delivered, recording the provider's id for correlation. */
export async function markContactMessageSent(
  id: string,
  providerId: string | null,
): Promise<void> {
  await prisma.contactMessage.update({
    where: { id },
    data: { deliveryStatus: "SENT", providerId, deliveryError: null },
  });
}

/** Marks a message as undeliverable, keeping the reason for later inspection. */
export async function markContactMessageFailed(
  id: string,
  error: string,
): Promise<void> {
  await prisma.contactMessage.update({
    where: { id },
    data: { deliveryStatus: "FAILED", deliveryError: error.slice(0, 500) },
  });
}
