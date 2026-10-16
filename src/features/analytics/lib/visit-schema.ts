import { z } from "zod";

/**
 * Validation for the client visit beacon (`POST /api/visit`).
 *
 * Three shapes, all keyed off which id/path the payload carries:
 *
 *  - `{ pageViewId, client }` — attach specs (and dwell) to the page view the
 *    proxy created for a hard load.
 *  - `{ pageViewId, dwellMs }` — a dwell close-out when the visitor leaves.
 *  - `{ path, client, closePageViewId?, closeDwellMs? }` — a client-side
 *    navigation: register a new page view, optionally closing the previous one
 *    with how long it was looked at.
 *
 * Everything is bounded: the endpoint is public, so no field may grow a row
 * without limit. Bounds here are generous for real browsers and hostile to
 * anything trying to park a payload in the table.
 */

const id = z.string().min(1).max(64);

/** Dwell times are capped at a day — anything beyond is a bug or an attack. */
const dwell = z.number().int().min(0).max(24 * 60 * 60 * 1000);

const coord = z.number().finite().min(0).max(30000);

const clientSpecs = z.object({
  screen: z.tuple([coord, coord]),
  viewport: z.tuple([coord, coord]),
  dpr: z.number().finite().min(0).max(100),
  cores: z.number().int().min(0).max(1024).nullish(),
  memoryGb: z.number().finite().min(0).max(1024).nullish(),
  timezone: z.string().max(64).nullish(),
  connection: z.string().max(32).nullish(),
  touch: z.boolean().nullish(),
  colorDepth: z.number().int().min(0).max(64).nullish(),
  lang: z.string().max(35).nullish(),
});

export const visitBeaconSchema = z
  .object({
    pageViewId: id.optional(),
    path: z
      .string()
      .max(500)
      .refine((p) => p.startsWith("/") && !p.startsWith("//"), {
        error: "invalid path",
      })
      .refine((p) => !p.startsWith("/admin") && !p.startsWith("/api"), {
        error: "path out of scope",
      })
      .optional(),
    client: clientSpecs.optional(),
    dwellMs: dwell.nullish(),
    closePageViewId: id.nullish(),
    closeDwellMs: dwell.nullish(),
  })
  .refine(
    (b) =>
      // create: a path always comes with specs
      (Boolean(b.path) && Boolean(b.client)) ||
      // attach / dwell: an existing page view id plus something to say
      (Boolean(b.pageViewId) && (Boolean(b.client) || Boolean(b.dwellMs))),
    { error: "payload does not describe a known beacon mode" },
  );

export type VisitBeaconInput = z.output<typeof visitBeaconSchema>;