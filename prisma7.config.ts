// Prisma 7 CLI configuration.
//
// The filename matters: Prisma 7 searches for `prisma7.config.*` first and only
// falls back to `prisma.config.*`, which it treats as legacy. Verified in
// @prisma/config's loader (PRISMA7_CONFIG_FILE_CANDIDATES).
//
// Prisma 7 no longer reads .env by itself, and the datasource url has moved out
// of schema.prisma into this file — so both of the lines below are load-bearing.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    /*
     * Run by `prisma migrate dev` and `prisma migrate reset` after migrations
     * are applied.
     *
     * The `.mts` extension is required, not stylistic: the project has no
     * `"type": "module"`, so tsx would treat a plain `.ts` file as CJS — which
     * rejects top-level await and cannot load the ESM client that the
     * `moduleFormat = "esm"` generator emits.
     */
    seed: "tsx prisma/seed.mts",
  },

  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
