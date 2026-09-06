# Deployment

Self-hosted on an Ubuntu VPS behind nginx. No serverless, no Vercel.

## App

```bash
sudo cp deploy/systemd/portfolio-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now portfolio-app.service
```

Or run `deploy/deploy.sh` from `/srv/portfolio`, which pulls, installs with
`--frozen-lockfile`, migrates, builds and restarts in the order below.

### Order matters

1. `.env` holds **production** values first — especially `NEXT_PUBLIC_SITE_URL`.
2. `pnpm db:deploy` (never `migrate dev` outside development).
3. `pnpm build`.
4. Restart the service.

The build prerenders pages by querying Postgres, so the tables must exist before
it runs — and `NEXT_PUBLIC_SITE_URL` is baked into the sitemap and metadata at
build time. Building against `localhost:3000` silently ships localhost URLs, so
step 1 is not optional.

`next start` needs `.next` writable at runtime (ISR writes), which is why the
unit's `ReadWritePaths` covers the tree rather than carving out a subpath.

## GitHub stats refresh

GitHub is never called from a request path. A systemd timer runs a script that
writes into the `GithubStatsCache` table, and the app only ever reads from
Postgres — so there is no client-facing rate limit, and the panel keeps working
when GitHub is unreachable.

```bash
sudo cp deploy/systemd/portfolio-github-stats.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now portfolio-github-stats.timer

# Verify
systemctl list-timers portfolio-github-stats.timer
sudo systemctl start portfolio-github-stats.service   # run once, now
journalctl -u portfolio-github-stats.service -n 30
```

Edit `User`, `Group`, `WorkingDirectory` and the `pnpm` path in the `.service`
file to match the server before enabling.

The unit **exits non-zero when any cache key fails**, on purpose: a red unit
means the operator should look. It is not fatal to the site — a failed refresh
leaves the previous payload untouched, and the page shows it with an honest
"updated X ago".

### Environment

`EnvironmentFile=/srv/portfolio/.env` supplies `DATABASE_URL`, `GITHUB_TOKEN` and
`GITHUB_USERNAME`. Keep it `chmod 600` and owned by the service user: systemd
unit files are world-readable, which is why the secrets are not inlined there.

`GITHUB_TOKEN` needs **no scopes** for public data, but it is not optional for
the commit heatmap. GitHub exposes contribution counts only through the GraphQL
API, and GraphQL rejects unauthenticated requests even for public profiles.
Without a token the stars, forks and repo counters still populate and only the
heatmap is missing — each cache key succeeds or fails independently.

## nginx

The contact form's per-IP rate limiting depends on the real client address. Behind
a proxy the socket address is always `127.0.0.1`, so without this header every
visitor shares one bucket and the per-IP rule becomes a global one:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        "upgrade";
}
```

## Cache and ISR

Next stores its cache on local disk, which is correct for a single `next start`
instance with persistent storage — the case here. Running more than one instance
would need a shared cache handler; see the self-hosting guide before scaling out.
