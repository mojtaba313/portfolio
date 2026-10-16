import { z } from "zod";

/**
 * Admin input validation.
 *
 * Each schema mirrors its Prisma model but speaks form: checkboxes arrive as
 * `"on"` or missing, numbers and dates as strings, empty optionals as `""`.
 * Transforms normalise all of that before the actions ever see it, so the
 * database layer only ever receives clean types.
 */

/** Action state for `useActionState` admin forms: absent error means busy. */
export type AdminActionState = { error?: string };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v?.length ? v : null));

const optionalUrl = () =>
  z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v?.length ? v : null))
    .refine((v) => v === null || /^https?:\/\/.+\..+/.test(v), {
      error: "نشانی باید با http(s) شروع شود.",
    });

const checkbox = z
  .string()
  .nullish()
  .transform((v) => v === "on");

const intField = (fallback: number) =>
  z
    .string()
    .nullish()
    .transform((v) => {
      const n = Number.parseInt(v ?? "", 10);
      return Number.isFinite(n) ? n : fallback;
    });

export const adminProjectSchema = z.object({
  title: z.string().trim().min(1, { error: "عنوان لازم است." }).max(120),
  slug: z
    .string()
    .trim()
    .min(1, { error: "شناسه لازم است." })
    .max(80)
    .regex(/^[a-z0-9-]+$/, { error: "شناسه فقط حروف کوچک، عدد و خط تیره." }),
  summary: z.string().trim().min(1, { error: "خلاصه لازم است." }).max(500),
  description: optionalText(20000),
  problem: optionalText(2000),
  solution: optionalText(2000),
  client: optionalText(120),
  liveUrl: optionalUrl(),
  repoUrl: optionalUrl(),
  coverImage: optionalText(500),
  completedAt: z
    .string()
    .nullish()
    .transform((v) => (v?.length ? new Date(`${v}T00:00:00`) : null)),
  displayOrder: intField(0),
  featured: checkbox,
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export type AdminProjectInput = z.output<typeof adminProjectSchema>;

export const adminSkillSchema = z.object({
  name: z.string().trim().min(1, { error: "نام لازم است." }).max(60),
  slug: z
    .string()
    .trim()
    .min(1, { error: "شناسه لازم است." })
    .max(60)
    .regex(/^[a-z0-9-]+$/, { error: "شناسه فقط حروف کوچک، عدد و خط تیره." }),
  category: z.enum([
    "LANGUAGE",
    "FRONTEND",
    "BACKEND",
    "DATABASE",
    "DEVOPS",
    "TOOLING",
  ]),
  proficiency: z
    .string()
    .nullish()
    .transform((v) => {
      const n = Number.parseInt(v ?? "", 10);
      return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3;
    }),
  color: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v?.length ? v : null))
    .refine((v) => v === null || /^#[0-9a-fA-F]{6}$/.test(v), {
      error: "رنگ باید HEX مثل #3178c6 باشد.",
    }),
  description: optionalText(500),
  displayOrder: intField(0),
});

export type AdminSkillInput = z.output<typeof adminSkillSchema>;

export const adminJokeSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, { error: "شناسه لازم است." })
    .max(60)
    .regex(/^[a-z0-9-]+$/, { error: "شناسه فقط حروف کوچک، عدد و خط تیره." }),
  text: z.string().trim().min(1, { error: "متن لطیفه لازم است." }).max(500),
  active: checkbox,
});

export type AdminJokeInput = z.output<typeof adminJokeSchema>;
