import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma Client singleton.
 *
 * Two Prisma 7 changes shape this file:
 *
 *  1. A **driver adapter is required**. Prisma 7 dropped the Rust query engine
 *     for Postgres, so `new PrismaClient()` with a bare connection string no
 *     longer works — queries go through `pg` via `PrismaPg`. The only
 *     alternative is `accelerateUrl`, which is Prisma's hosted proxy and
 *     irrelevant for a self-hosted VPS.
 *  2. The client is generated into `src/generated/prisma` as TypeScript source
 *     rather than into `node_modules`, so it is imported by path and is build
 *     output (gitignored, recreated by `pnpm db:generate`).
 *
 * The globalThis cache exists because `next dev` hot-reloads module graphs on
 * every edit. Without it each reload would construct a new client and open a new
 * connection pool until Postgres refuses connections. Production creates exactly
 * one instance, so the cache is dev-only by design.
 */

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    // Fail loudly at construction rather than at the first query, where the
    // error would surface as a confusing adapter fault deep in a render.
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
    );
  }

  /*
   * `options=-c timezone=UTC` is load-bearing, not decoration.
   *
   * Prisma maps DateTime to `timestamp WITHOUT TIME ZONE` and writes JS Dates
   * as **UTC** wall-clock. Any timestamp Postgres produces on its own —
   * `@default(now())`, `now()` in a raw query — is rendered in the *session*
   * timezone instead. On a box set to Asia/Tehran that is +3h30m, so the two
   * conventions land in the same columns and `WHERE "lastActivityAt" > $1`
   * compares numbers that are three and a half hours apart. Forcing the
   * connection to UTC makes both sides speak the same wall-clock.
   */
  const adapter = new PrismaPg({
    connectionString,
    options: "-c timezone=UTC",
  });

  return new PrismaClient({
    adapter,
    // Queries are noisy and only useful when actively debugging; warnings and
    // errors are always worth surfacing.
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
