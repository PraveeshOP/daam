# Deploying daam

The app is two processes — a Next.js web app and a BullMQ worker — but only one of them needs
hosting. This describes a deployment that costs nothing.

| Piece | Where | Notes |
| --- | --- | --- |
| Web app | Vercel | `.github/workflows/deploy.yml` already exists |
| Database & auth | Supabase | already in use |
| Price collection | GitHub Actions | `.github/workflows/collect.yml`, replaces the worker |
| Redis | Upstash (optional) | only needed for admin Collections + alert emails |
| Email | Resend | already in use |

## ⚠️ Read this before choosing Vercel

**Vercel's Hobby plan is for non-commercial use only.** This project has an affiliate system
(`docs/affiliate-system.md`): stores carry `affiliate_enabled`, and `/go/[offerId]` records
click-throughs that can earn commission.

Affiliates are currently disabled on every store, so the site is non-commercial as it stands.
**Enabling affiliate links or ads would put the deployment outside Hobby's terms** and require a
paid plan. If monetisation is the plan, host the web app somewhere whose free tier permits
commercial use instead — Cloudflare Workers (Next.js via `@opennextjs/cloudflare`) or Netlify
(official Next runtime). Nothing else here changes: collection runs in GitHub Actions and is
entirely independent of where the web app is hosted.

Free-tier limits change. Check each provider's current terms rather than trusting this table.

## 1. Web app on Vercel

Create the Vercel project (import the GitHub repo, framework auto-detects as Next.js), then set
these in **Project → Settings → Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL          https://<your-domain>
RESEND_API_KEY
EMAIL_FROM                    daam <alerts@your-domain>
REDIS_URL                     (see §3 — omit and some features degrade, see below)
```

`NEXT_PUBLIC_SITE_URL` must be the real deployed origin: price-alert emails build their links
from it, and `app/sitemap.ts` uses it for every URL.

The repo can either deploy through Vercel's own Git integration (simplest), or through the
existing workflow. To use the workflow, set repo variable `ENABLE_VERCEL_DEPLOY=true` and secrets
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Do not enable both, or every push deploys
twice.

## 2. Price collection on GitHub Actions

`collect.yml` runs daily at 01:15 UTC (~07:00 in Nepal). It needs two repo secrets:

```
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Collection writes through the service-role client, which bypasses RLS — hence the service key
rather than the anon key. Keep it in Actions secrets, never in the repo.

**Why a schedule and not the worker.** The worker needs an always-on Node process, which no free
tier offers. It is not required: `npm run collect:*` calls `runStoreCollection` directly, with no
Redis and no queue, so a scheduled job does the same work.

**Why the catalogue is sharded across the week.** A full sweep of all 38 collectors takes about
3h25m and re-fetches every category page of every store. Running that daily is wasteful and hard
on the stores — during development, repeatedly sweeping one store got this project blocked at the
TLS layer by that store's edge. So each day collects roughly a seventh of the collectors, giving
every store a full-depth refresh once a week, and the job never fans out in parallel.

To collect specific stores immediately, run the workflow manually (**Actions → Collect prices →
Run workflow**) with a space-separated list, or `all` for a complete sweep.

## 3. Redis (optional, but some things break without it)

`lib/queue/redis.ts` throws when `REDIS_URL` is unset. What actually happens without it:

**Still works** — browsing, search, product pages, price comparison, `/go/[offerId]`
click-through. Both rate limiters (`lib/auth/rateLimit.ts`, `lib/stores/clickRateLimit.ts`) fail
**open** by design: an infrastructure hiccup must never become a site-wide login outage. Note the
trade-off — with Redis absent, login/signup are unthrottled.

**Breaks** — the admin *Collections* page (it reads BullMQ job history) and price-alert emails
(they enqueue through the notifications queue).

Upstash has a free Redis tier and installs from the Vercel marketplace, which sets `REDIS_URL`
for you.

## 4. After the first deploy

- Grant yourself admin: `profiles.role = 'admin'` for your user (see `lib/admin/auth.ts`).
- Apply any pending migrations: `supabase db push`.
- Confirm `/`, `/search`, `/marketplace` and a product page render, then `/admin`.
- Trigger **Collect prices** manually once so the first run is observed rather than assumed.
