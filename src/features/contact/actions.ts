"use server";

import { headers } from "next/headers";

import {
  checkRateLimit,
  createContactMessage,
  markContactMessageFailed,
  markContactMessageSent,
} from "@/lib/db/contact";
import { getMailConfig } from "@/lib/resend";
import {
  contactSchema,
  type ContactData,
  type ContactResult,
} from "@/lib/validation/contact";

/**
 * Reads the client IP from proxy headers.
 *
 * The VPS runs behind nginx, so the socket address is always 127.0.0.1 and
 * X-Forwarded-For is the only source of the real client. That header is
 * trivially spoofable by anyone talking to the app directly, which is acceptable
 * here because it only feeds rate limiting — the worst case is a determined
 * abuser rotating a value to evade a soft cap, and the per-email limit still
 * applies.
 *
 * nginx must be configured with `proxy_set_header X-Forwarded-For
 * $proxy_add_x_forwarded_for;` for this to be meaningful.
 */
async function getClientContext() {
  const headerList = await headers();

  // XFF is a comma-separated chain; the leftmost entry is the original client.
  const forwarded = headerList.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip")?.trim() ||
    null;

  return { ip, userAgent: headerList.get("user-agent") };
}

/** Formats the notification email. Plain text: it is a machine-to-me message. */
function buildEmail(data: ContactData) {
  const subject = data.subject
    ? `[Portfolio] ${data.subject}`
    : `[Portfolio] New message from ${data.name}`;

  const text = [
    `Name:    ${data.name}`,
    `Email:   ${data.email}`,
    `Subject: ${data.subject ?? "—"}`,
    "",
    data.message,
  ].join("\n");

  return { subject, text };
}

/**
 * Handles a contact form submission.
 *
 * Order is deliberate: validate, then rate limit, then **persist**, then send.
 * Persisting before sending is what makes a Resend outage non-destructive — the
 * row already exists, and delivery failure only downgrades its status.
 *
 * Errors are always returned as values rather than thrown. A thrown error in a
 * Server Action reaches the client as an opaque digest, which would tell the
 * visitor nothing and lose the distinction between "your input was wrong" and
 * "our mail provider is down".
 */
export async function submitContactForm(
  input: unknown,
): Promise<ContactResult> {
  // Re-validation, not double validation: this is a public HTTP endpoint and the
  // client parse is only a UX affordance.
  const parsed = contactSchema.safeParse(input);

  if (!parsed.success) {
    // Zod v4: flatten() is deprecated in favour of treeifyError, but a flat
    // field->message map is exactly what the form needs, so build it directly.
    const fieldErrors: Partial<Record<keyof ContactData, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !(field in fieldErrors)) {
        fieldErrors[field as keyof ContactData] = issue.message;
      }
    }

    return {
      status: "error",
      reason: "validation",
      message: "لطفاً خطاهای فرم را برطرف کنید.",
      fieldErrors,
    };
  }

  const data = parsed.data;

  /*
   * Honeypot. Checked here rather than in the schema because this is the only
   * side of the wire that can be trusted — a bot that ignores JavaScript never
   * runs the client validation.
   *
   * Reports success without persisting or sending. Returning an error would tell
   * the bot exactly which field gave it away, and the field is off-screen,
   * aria-hidden, tabIndex -1 and autocomplete="off", so a real visitor cannot
   * reach it. Logged so the decision is observable rather than invisible.
   */
  if (data.botField) {
    console.warn("Contact: rejected a submission that filled the honeypot");
    return { status: "success" };
  }

  const { ip, userAgent } = await getClientContext();

  /*
   * Guarded: an unguarded throw here would escape the action entirely and reach
   * the client as an opaque digest, losing the distinction between "you sent too
   * many" and "the database is unreachable". Failing open is the right call for a
   * rate limiter — a contact form that refuses everyone because Postgres blinked
   * is worse than one that briefly lets a flood through, and the write below
   * would fail anyway if the database were truly down.
   */
  let verdict: Awaited<ReturnType<typeof checkRateLimit>> = { allowed: true };
  try {
    verdict = await checkRateLimit({ ip, email: data.email });
  } catch (error) {
    console.error("Contact: rate limit check failed, allowing through", error);
  }

  if (!verdict.allowed) {
    return {
      status: "error",
      reason: "rate_limited",
      message:
        verdict.scope === "email"
          ? "از این ایمیل به‌تازگی چند پیام فرستاده شده است. کمی بعد دوباره تلاش کنید."
          : "تعداد پیام‌های ارسالی زیاد بوده است. یک ساعت بعد دوباره تلاش کنید.",
    };
  }

  let messageId: string;
  try {
    const record = await createContactMessage({ data, ip, userAgent });
    messageId = record.id;
  } catch (error) {
    // Nothing was stored, so there is nothing to reconcile — report honestly
    // rather than claiming success.
    console.error("Contact: failed to persist message", error);
    return {
      status: "error",
      reason: "unknown",
      message: "ذخیرهٔ پیام ممکن نشد. کمی بعد دوباره تلاش کنید.",
    };
  }

  const mail = getMailConfig();
  if (!mail) {
    // The message is safely stored; only the notification is missing. Treating
    // this as success would hide a misconfiguration from the site owner.
    await markContactMessageFailed(messageId, "Mail is not configured");
    console.error("Contact: RESEND_API_KEY / CONTACT_* env vars are not set");
    return {
      status: "error",
      reason: "delivery",
      message:
        "پیام شما ذخیره شد، اما ارسال ایمیل ممکن نشد. اگر پاسخی نگرفتید، مستقیم تماس بگیرید.",
    };
  }

  const { subject, text } = buildEmail(data);

  try {
    const { data: sent, error } = await mail.resend.emails.send({
      from: mail.from,
      to: mail.to,
      subject,
      text,
      // So a reply in the mail client goes to the sender, not to myself.
      replyTo: data.email,
    });

    // Resend reports failures as a value on the response, not by throwing, so
    // this branch is the common failure path rather than the catch below.
    if (error) {
      await markContactMessageFailed(messageId, error.message);
      console.error("Contact: Resend rejected the message", error);
      return {
        status: "error",
        reason: "delivery",
        message:
          "پیام شما ذخیره شد، اما ارسال ایمیل ناموفق بود. به‌زودی بررسی می‌شود.",
      };
    }

    await markContactMessageSent(messageId, sent?.id ?? null);
    return { status: "success" };
  } catch (error) {
    // Network-level failure reaching Resend at all.
    const reason = error instanceof Error ? error.message : String(error);
    await markContactMessageFailed(messageId, reason);
    console.error("Contact: could not reach Resend", error);
    return {
      status: "error",
      reason: "delivery",
      message:
        "پیام شما ذخیره شد، اما ارسال ایمیل ناموفق بود. به‌زودی بررسی می‌شود.",
    };
  }
}
