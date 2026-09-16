import { z } from "zod";

/**
 * Contact form schema.
 *
 * One schema, both sides. The client validates with it through
 * @hookform/resolvers for instant feedback, and the Server Action parses with it
 * again — not out of redundancy, but because a Server Action is a public HTTP
 * endpoint. Anyone can POST to it directly, so client validation is a UX feature
 * and the server parse is the only actual guarantee.
 *
 * Zod v4 notes: the error customisation API is `{ error: ... }` rather than v3's
 * `{ message: ... }`/`invalid_type_error`, and `z.email()` is a top-level
 * function instead of `z.string().email()`.
 *
 * Messages are Persian because they surface in the form. The terminal's English
 * rule does not apply here.
 */

/** Shared bounds, exported so the inputs can set maxLength to match. */
export const CONTACT_LIMITS = {
  nameMax: 80,
  subjectMax: 120,
  messageMin: 10,
  messageMax: 4000,
} as const;

/**
 * Converts Persian/Arabic-Indic digits to Latin so a phone number typed on a
 * Persian keyboard validates the same as one typed in Latin digits.
 */
function latinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

/**
 * Canonical phone form: Latin digits with visual separators removed, optional
 * leading `+` kept. Stored (and rate-limited) in this form so `0912 345 6789`
 * and `09123456789` count as the same sender.
 */
export function normalizePhone(value: string): string {
  return latinDigits(value).replace(/[\s\-().]/g, "");
}

/** True for a plausible international phone number: 7–15 digits, optional +. */
function isPhoneNumber(value: string): boolean {
  return /^\+?\d{7,15}$/.test(normalizePhone(value));
}

/** Deliberately simple — the schema's job is catching typos, not RFC 5322. */
function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Used by the Server Action: `replyTo` only makes sense for an email. */
export function isContactEmail(value: string): boolean {
  return value.includes("@");
}

export const contactSchema = z.object({
  name: z
    .string({ error: "نام را وارد کنید." })
    .trim()
    .min(2, { error: "نام باید حداقل ۲ نویسه باشد." })
    .max(CONTACT_LIMITS.nameMax, {
      error: `نام نباید بیشتر از ${CONTACT_LIMITS.nameMax} نویسه باشد.`,
    }),

  /*
   * Email **or** phone: the visitor leaves whichever way reaches them. The key
   * stays `email` (and maps to the existing `ContactMessage.email` column) so
   * no migration is needed — but the value may be a phone number, which is why
   * the label, the notification body and `replyTo` all treat it as an opaque
   * contact handle rather than assuming an address.
   */
  email: z
    .string({ error: "راه ارتباطی را وارد کنید." })
    .trim()
    .min(1, { error: "راه ارتباطی را وارد کنید." })
    .refine((value) => isEmailAddress(value) || isPhoneNumber(value), {
      error: "ایمیل یا شماره تماس معتبر نیست.",
    })
    // Normalised so rate limiting and duplicate checks compare like with like:
    // emails lowercased, phones in canonical digit form.
    .transform((value) =>
      value.includes("@") ? value.toLowerCase() : normalizePhone(value),
    ),

  /*
   * `nullish()` rather than `optional()`, and this is the fix for a real bug.
   *
   * The transform maps "" to null so the column means "no subject" instead of
   * holding a blank string. But the client sends the *transformed* values to the
   * Server Action, which parses with this same schema — so the schema has to
   * accept its own output. With `optional()` (which allows undefined but not
   * null) every submission with an empty subject failed server-side with
   * "expected string, received null", and the visitor saw a validation error on
   * a field they had left blank.
   *
   * `nullish()` makes the schema idempotent: "" -> null, null -> null, "x" -> "x".
   * Any transform in a schema used on both sides of the wire needs this property.
   */
  subject: z
    .string()
    .trim()
    .max(CONTACT_LIMITS.subjectMax, {
      error: `موضوع نباید بیشتر از ${CONTACT_LIMITS.subjectMax} نویسه باشد.`,
    })
    .nullish()
    .transform((value) => (value ? value : null)),

  message: z
    .string({ error: "پیام را وارد کنید." })
    .trim()
    .min(CONTACT_LIMITS.messageMin, {
      error: `پیام باید حداقل ${CONTACT_LIMITS.messageMin} نویسه باشد.`,
    })
    .max(CONTACT_LIMITS.messageMax, {
      error: `پیام نباید بیشتر از ${CONTACT_LIMITS.messageMax} نویسه باشد.`,
    }),

  /**
   * Honeypot: a hidden field real users never fill and naive bots always do.
   *
   * Deliberately unconstrained here. Enforcing "must be empty" in the schema
   * would put the check on the client, where it is useless — bots that skip
   * JavaScript never run it — while giving a real user who somehow tripped it an
   * error on an invisible field they cannot fix. The rejection happens in the
   * Server Action instead, which is the only place it can actually be trusted.
   */
  botField: z.string().nullish(),
});

export type ContactInput = z.input<typeof contactSchema>;
export type ContactData = z.output<typeof contactSchema>;

/**
 * Result of a submission, returned by the Server Action.
 *
 * A discriminated union rather than `{ ok, error? }` so the client cannot read
 * `fieldErrors` on a success or forget to handle a failure — the compiler
 * enforces the branch.
 */
export type ContactResult =
  | { status: "success" }
  | {
      status: "error";
      /** Which failure this was, so the UI can word it appropriately. */
      reason: "validation" | "rate_limited" | "delivery" | "unknown";
      /** Human-readable Persian message, safe to render. */
      message: string;
      /** Per-field messages, keyed by field name, for validation failures. */
      fieldErrors?: Partial<Record<keyof ContactData, string>>;
    };
