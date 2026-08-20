# Production scaling, reliability, and security (phase 9)

This phase was an audit-first pass, not a rewrite: measure first, fix what's actually wrong, and
leave working code alone otherwise. What follows is what the audit found, what was fixed, and
what was deliberately left as a documented recommendation rather than rushed.

## What was fixed

**Data integrity (collectors/core/importer.ts, worker/processor.ts).** Two real correctness bugs:

- A job's hard timeout couldn't actually cancel the underlying collection work — it kept running
  in the background after being reported as failed. Releasing the per-store Redis lock the moment
  the timeout fired (the old behavior) meant a retry could start a *second*, concurrent
  collection for the same store while the first was still writing to `offers`/`price_history`.
  The lock is now released when the real work actually settles, never when the caller merely
  stops waiting for it — regression-tested in `worker/processor.test.ts`.
- `offers.price` was updated *before* `price_history` got its row. A crash between the two writes
  permanently lost that price point, because the next run's "did the price change" check read
  `offers.price` (already updated) instead of `price_history` (never written). The write order is
  now flipped and `price_history` is the source of truth for "did it change" — a crash between the
  two writes now self-heals on the next run instead of losing data. Verified live against the real
  Supabase project, including the exact crash scenario (see the phase-9 report for details).
- The product-matcher candidate query was capped at 1,000 rows with no `order by` (non-
  deterministic once the catalog exceeds the cap) and was re-run once per discovered product
  instead of once per collection run. Both fixed: it's now fetched once per run, ordered
  deterministically, and grown in-place as new products are created within that same run.
- A scraped price could be a wrong-but-still-positive number (decimal slip, EMI price, currency
  mixup) with nothing catching it. `collectors/core/priceIntegrity.ts` now flags (never blocks) a
  >5x or <0.2x swing from the last recorded price, surfaced in the collection summary the same way
  uncertain product matches already are.
- `check (price >= 0)` allowed exactly zero straight into `offers`/`price_history`. Both parsers
  already reject non-positive prices in application code, so this was defense-in-depth: a new
  `check (price > 0)` constraint on both tables (migration `20260823_add_production_hardening.sql`).

**Query/caching (lib/data.ts).** The shared product select used by the homepage and every search
result used to also fetch *every* historical price point ever recorded for every matching product,
even though nothing in those views renders price history. Split into a list select (no
`price_history`) and a detail select (bounded to the ~6 months the UI actually shows and claims to
show). An empty/broad `/search` query also had no cap at all; it's now capped at 200 results — a
stopgap, not real pagination (see "Deliberately not done" below for why).

**Indexing/search (migration `20260823_add_production_hardening.sql`).** Added an index
`analytics_events (created_at desc)` for the one admin-analytics query that filters by date alone
(the existing composite index leads with `event_name`, so it couldn't serve that query). Added
`pg_trgm` GIN indexes on `products.name`/`products.brand` — the existing `lower(column)` btree
indexes only serve prefix matches, but every actual search here is `ilike '%term%'`.

**Security.**
- Login/signup/password-reset had no rate limiting at all — a real brute-force/credential-
  stuffing/email-bombing target. `lib/auth/rateLimit.ts` reuses the same Redis fixed-window-
  counter approach as the existing click rate limiter (5/15min for login, 3/hour for signup and
  password reset, keyed by IP read from request headers — never persisted anywhere).
- `trackEventAction` (a Server Action, currently unused by any component) only had type-level
  validation, which doesn't stop an arbitrary network caller. It now validates the event name
  against the real allowlist at runtime, caps the properties payload size, and rate-limits itself
  — all *before* it's ever wired up, not after.
- `lib/email/client.ts` logged a real recipient email address in plaintext on every retry when the
  email provider wasn't configured. Fixed to log the subject only. Also added an explicit 15s
  timeout on the outbound Resend call, matching every other outbound call in this codebase.

**SEO/error pages.** None of `metadataBase`, `robots.ts`, `sitemap.ts`, `not-found.tsx`, or
`global-error.tsx` existed. All five added — sitemap pulls real product slugs (capped at 5,000,
well under the format's 50,000-URL limit), robots disallows `/admin`, `/account`, `/favorites`,
`/alerts`, and `/go/` (the outbound redirect should never itself be indexed).

**Staleness (components/OfferTable.tsx).** `last_checked` already flowed all the way to the
public `Offer` type but was only ever surfaced on admin pages. The same staleness rule
(`lib/offers/staleness.ts`, moved out of the admin-only module it used to live in) now shows a
"Price may be outdated" note per offer on the product page itself.

**Operational.**
- `GET /api/health` — unauthenticated, read-only, checks Supabase and Redis reachability. Meant to
  be cheap enough to poll every minute from an external uptime monitor.
- `npm run analytics:prune` — `analytics_events` had no retention plan at all. This deletes rows
  older than a configurable window (400 days by default; every current admin-analytics view only
  ever looks back 90 days, so this loses nothing any view reads). See "Deliberately not done" for
  why this is a runnable command and not an automated recurring job yet.
- `worker/README.md` now documents that the worker (which the whole scheduled-collection/price-
  alert pipeline depends on) has no automated deploy path today — only the Next.js app does — and
  what a minimal, correctly-scoped fix looks like (one always-on process, not a fleet).

## Deliberately not done (and why)

**Broad caching / ISR.** The product/search/home path is fully dynamic today (nothing reads
`unstable_cache`/`revalidate`, and `getCurrentUser()` forces dynamic rendering via `cookies()`).
For a price-comparison site, a stale cached price is a real trust problem, so "just add
`revalidate`" is not a safe quick patch — it needs a deliberate design that separates the
personalized bits (favorite state, login state) from the shared, genuinely cacheable bits (product
data, which only changes when the collector runs, every few hours), most likely via a Suspense-
streamed favorite/auth slot around a cached product shell, tag-invalidated on collection runs.
Scoping and shipping that safely is its own phase, not a paragraph in this one.

**Full paginated + faceted search.** `/search` has an in-memory filter stage (store/price/stock)
and a `FilterSidebar` that derives its facet options from the *full* matching result set. Real
DB-level pagination has to account for both of those staying correct — done as a quick patch, it
would risk facets/counts quietly going wrong once a page boundary cuts through the filtered set.
The 200-result cap added this phase removes the "can load the entire catalog" risk without
touching that architecture; real pagination is the correct next step once the catalog is large
enough to hit that cap in practice (it currently isn't).

**Automated critical-alert notifications.** `getSystemAlerts()` (already computed, already shown
on `/admin/observability`) is pull-only — nobody is notified if the page isn't opened. The natural
implementation (have the worker email the admin when a critical alert appears) is blocked on a
real architectural fact: the function it would reuse reads through a cookie-scoped Supabase client
that only works inside a Next.js request, and the worker process has no such request context.
Doing this properly means giving that data path a request-independent path first — worth doing,
but as its own deliberate change, not a bolt-on here. Recommended for the next phase.

**Data-quality dashboard scan caps.** `lib/admin/dataQuality.ts`'s three counts (offers without
products, duplicate products, broken URLs) cap their scans at 20k/50k rows. At today's catalog
size this is a non-issue; flagged only so it isn't forgotten once the catalog is large enough for
the cap to under-count.

## Load testing

Web: a simple concurrent-fetch script against a production build (`next build && next start`),
not dev mode (dev-mode Turbopack compilation overhead makes those numbers meaningless for
capacity planning).

| Route | Concurrency | Requests | p50 | p95 | max | errors |
|---|---|---|---|---|---|---|
| `/` | 10 | 50 | 137ms | 261ms | 271ms | 0 |
| `/search` | 10 | 50 | 151ms | 408ms | 460ms | 0 |
| `/product/[slug]` | 10 | 50 | 135ms | 214ms | 219ms | 0 |
| `/` | 30 | 150 | 158ms | 379ms | 443ms | 0 |
| `/search` | 30 | 150 | 354ms | 572ms | 875ms | 0 |
| `/api/health` | 20 | 100 | 175ms | 196ms | 213ms | 0 |

Zero errors at 30 concurrent requests — comfortably above what a small Nepal-focused site sees in
practice today. `/search`'s p95 degrading faster than the other routes under load lines up
directly with the "no result cap, drags every offer/history row" issue fixed this phase; worth
re-measuring after the fix has been live for a while under real traffic.

Background jobs: not load-tested against real store websites (that would mean hammering third-
party sites, which this project has no business doing for a load test). Instead, reasoned from
configuration: `WORKER_CONCURRENCY=2` and the per-store Redis lock mean at most 2 stores collect
at once regardless of how many jobs get enqueued — this is deliberate backpressure, not a
limitation to fix. The worst-case single-store duration (`COLLECTION_PRODUCT_LIMIT` ×
(`COLLECTOR_REQUEST_TIMEOUT_MS` + inter-item delay)) is now what `COLLECTION_JOB_TIMEOUT_MS`'s
default is actually derived from (see `worker/processor.ts`), so the two can't drift out of sync
the way they had before this phase.

## Search scaling

Kept on Postgres (`ilike` + the new `pg_trgm` indexes) per the phase brief's own instruction —
nothing measured this phase suggested Postgres text search is anywhere near its limits for this
catalog size.
