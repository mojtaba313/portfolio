import { Resend } from "resend";

/**
 * Resend client.
 *
 * Lazily constructed rather than created at module scope: the module is imported
 * by the Server Action, which Next evaluates during `next build`, and a missing
 * RESEND_API_KEY would then fail the build rather than the one request that
 * actually needs to send mail. Contact delivery being misconfigured should not
 * stop the site from deploying.
 */

let client: Resend | null = null;

export type MailConfig = {
  resend: Resend;
  from: string;
  to: string;
};

/**
 * Returns the client and addresses, or null when mail is not configured.
 *
 * Null rather than throwing, so the caller can record the submission and report
 * a delivery problem instead of surfacing a crash.
 */
export function getMailConfig(): MailConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !from || !to) return null;

  client ??= new Resend(apiKey);
  return { resend: client, from, to };
}
