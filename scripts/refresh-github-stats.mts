import "dotenv/config";

import { refreshGithubStats } from "../src/features/github-stats/lib/fetch-and-cache";
import { prisma } from "../src/lib/db/prisma";

/**
 * CLI entrypoint for the GitHub stats refresh, run by a systemd timer.
 *
 * A script rather than an HTTP route, so the schedule is not reachable from the
 * internet and needs no shared secret to protect it. See deploy/README.md for
 * the unit files.
 *
 * Exits non-zero when any key failed, which is what makes `systemctl status` and
 * `journalctl` useful: a red unit means the operator should look, and a green one
 * genuinely means the cache is current.
 */

const startedAt = Date.now();

try {
  const report = await refreshGithubStats();

  for (const outcome of report.outcomes) {
    const line = `${outcome.key.padEnd(14)} ${outcome.status.padEnd(7)} ${outcome.durationMs}ms`;
    if (outcome.status === "ok") {
      console.log(`[github-stats] ${line}`);
    } else {
      console.error(`[github-stats] ${line} — ${outcome.error}`);
    }
  }

  const total = Date.now() - startedAt;
  console.log(
    `[github-stats] done for ${report.username} in ${total}ms` +
      (report.hadFailures ? " (with failures)" : ""),
  );

  if (report.hadFailures) process.exitCode = 1;
} catch (error) {
  // Reached only for a fault outside any single key, such as missing config.
  console.error("[github-stats] refresh aborted:", error);
  process.exitCode = 1;
} finally {
  // Without this the pooled connection keeps the process alive and the systemd
  // unit hangs until its timeout instead of completing.
  await prisma.$disconnect();
}
