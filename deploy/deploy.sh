#!/usr/bin/env bash
#
# Deploy the portfolio on the VPS. Run from /srv/portfolio as the service user.
# Safe to re-run: every step is idempotent, and the app restarts only at the end.
#
set -euo pipefail

cd /srv/portfolio

git pull --ff-only
pnpm install --frozen-lockfile

# Migrations BEFORE the build, with `deploy` and never `dev`: the build
# prerenders pages by querying Postgres, so the tables must already exist, and
# `migrate dev` is forbidden outside development (it can shadow-db and prompt).
pnpm db:deploy

# Prisma Client regenerates via postinstall, but an explicit generate makes the
# build independent of install-hook behaviour.
pnpm db:generate

# Reads .env for DATABASE_URL (prerender queries) and NEXT_PUBLIC_SITE_URL
# (sitemap + metadata, baked into the HTML). Both must hold production values
# already — building against localhost silently bakes localhost URLs.
pnpm build

sudo systemctl restart portfolio-app.service
echo "Deployed. Check: systemctl status portfolio-app.service"
