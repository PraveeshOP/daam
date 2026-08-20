# Analytics and observability (phase 7)

Two separate concerns, kept separate on purpose (spec §2): **product analytics** (how people use
PriceNepal — search, view, click, favorite, alert) lives in Supabase (`analytics_events`) and is
readable only by admins. **System observability** (is the pipeline actually working — collection
duration, queue depth, failures) is OpenTelemetry traces/metrics plus the existing BullMQ/Supabase
data the admin dashboard already reads (phase 6) — nothing here duplicates that.

## Product analytics

### What's tracked

Exactly the events in spec §3, nothing more: `search`, `product_view`, `store_click`,
`favorite_added`/`favorite_removed`, `price_alert_created`/`price_alert_deleted`/`price_alert_triggered`.
See `lib/analytics/types.ts` for the exact property shape per event — a Postgres `check` constraint
on `analytics_events.event_name` enforces this list at the database level too.

### What's collected, and what deliberately isn't

Every event row can carry: `event_name`, `user_id` (nullable), `anonymous_id` (nullable),
`product_id`/`store_id` (nullable, for joins), and a small `properties` JSON object containing
only the fields listed above (a query string, a result count, a target price, ids). There is no
IP address column, no user agent, no request body, and obviously no password/token/session data
anywhere near this table — `lib/analytics/track.ts` is the only code that writes to it, and it
only ever receives the specific values each call site computed itself.

### How writing works

`analytics_events` has **no insert policy for `anon` or `authenticated` at all** — the only way a
row is ever written is through the service-role client in `lib/analytics/track.ts`, called from:

- Server Components that already have the data at render time (`search`, `product_view` — see
  `app/search/page.tsx`, `app/product/[slug]/page.tsx`), wrapped in `after()` from `next/server`
  so recording never delays the response (§25/§27).
- Existing Server Actions, right after their real mutation succeeds (`favorite_added`/`removed`
  in `app/actions/favorites.ts`, `price_alert_created`/`deleted` in `app/actions/alerts.ts`,
  `price_alert_triggered` in `worker/notificationProcessor.ts`).
- One small client component, `components/StoreClickLink.tsx`, for `store_click` — the one event
  with no other server round-trip to piggyback on. It calls a dedicated Server Action
  (`app/actions/analytics.ts#trackEventAction`) without awaiting it, so the external link opens
  immediately regardless of whether the tracking call has finished.

### Anonymous visitors

`proxy.ts` assigns a random `pn_aid` cookie (httpOnly, 1 year) to every first-time visitor,
alongside the existing Supabase session refresh — the same "mutate the request, not just the
response" trick that cookie already used, so the *current* render sees the id immediately instead
of only on the next request. `lib/analytics/identity.ts` reads it (plus the session, if any) for
every server-side tracking call. Logging in does **not** retroactively relink old anonymous events
to the account (spec §5) — an event recorded before sign-in keeps only its `anonymous_id`.

### Reading it back

`/admin/analytics` (admin-only, gated the same way as every other `/admin/*` page — see
`docs/admin-dashboard.md`) with a Today/7d/30d/90d range selector. GROUP BY aggregates
(top searches, zero-result searches, top products/stores, daily series for the charts) go through
plain SQL functions (`analytics_top_searches`, `analytics_top_products`, `analytics_top_stores`,
`analytics_daily_counts`, `analytics_active_users` — see the migration) since the supabase-js
query builder can't express GROUP BY; being plain (not `security definer`) functions, they still
run under the caller's RLS, so a non-admin gets nothing back from them either. "Most favorited" /
"most alerted" read the real `favorites`/`price_alerts` tables directly instead of the event log,
since those are ground truth and an event log of add/remove toggles would double-count.

Conversion metrics (§11) are presented as aggregate rates over the period (total store clicks ÷
total product views, etc.), explicitly not a per-visitor funnel — there's no session id linking
one visitor's search to their later click, and pretending otherwise would be a misleading metric.

## System observability

### OpenTelemetry

No OpenTelemetry existed before this phase. It's now wired into both halves of the app:

- **Web app**: `instrumentation.ts` (Next.js's own convention) calls `@vercel/otel`'s
  `registerOTel()`, which auto-instruments `fetch` — so Server Component/Action calls to
  Supabase's REST API get traced with no extra code.
- **Worker**: `lib/otel/worker.ts` sets up a `NodeSDK` by hand (it's a plain Node process, no
  Next.js instrumentation hook). `worker/index.ts` calls `startWorkerTelemetry()` **before**
  dynamically `import()`-ing the rest of the worker (`worker/run.ts`) — not a static import. This
  matters: a metric instrument (`meter.createCounter(...)`) created before the real
  `MeterProvider` is registered binds to the no-op one permanently, unlike spans (whose proxy
  re-resolves the active provider on every call) — confirmed live, see the final report.

Both export to an OTLP collector when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, otherwise fall back to
the console — so telemetry is visible in local dev with zero infrastructure, and pointing it at a
real backend later (Jaeger, Grafana, Honeycomb, ...) is a one-line env var change, not a code
change.

### Traces

`collectors/core/run.ts` wraps the collection pipeline's real phases in spans via
`lib/otel/tracing.ts#withSpan` — `collection.collect` (fetch+parse), `collection.import`
(the whole per-product loop), and one `collection.import_product` span per item. `worker/processor.ts`
wraps the whole thing in a top-level `collection.job` span. These are no-ops when no tracer
provider is registered, so they're safe to leave running for the manual `npm run collect:*` CLI
scripts too.

### Metrics

Exactly the list in spec §18 (`lib/otel/metrics.ts`): `store_collection_success_total`/
`_failure_total`, `store_collection_duration`, `products_collected_total`/`_matched_total`/
`_created_total`, `price_changes_total`, `bullmq_jobs_completed_total`/`_failed_total`,
`notification_sent_total`/`_failed_total`. Recorded at the same points the phase-4/5 code already
computes these numbers for its own summaries/logs — nothing is double-computed.

### Admin-visible system health

Deliberately *not* read back from OTel (that would need a full metrics backend + query API this
phase doesn't add — see §22 "do not create a full database administration system", applied to
observability too). Instead, `/admin/observability` (new) and `/admin/stores` (extended) read
BullMQ and Supabase directly, same as phase 6's Collections/Data-quality pages:

- **Store health as a percentage** (`lib/admin/stores.ts#deriveHealth`): completed ÷ (completed +
  failed) over the retained job history, skipped-due-to-lock jobs excluded from both sides.
- **Queue monitoring** (`lib/admin/observability.ts#getQueueStats`): waiting/active/completed/failed
  counts per queue via BullMQ's own `getJobCounts()`, oldest waiting job's age, average processing
  time from recent completed jobs, and the most recent failure reasons — admin-only, never raw
  Redis access.
- **System alerts** (`getSystemAlerts`): computed on read, not a background job — a store failing
  its last 3 attempts in a row, a store stale beyond the same threshold `/admin/data-quality`
  uses, or a queue with 5+/20+ failed jobs, shown as a plain list. No paging, no incident
  management (§23 is explicit about not building that yet).
- **Data-quality trend** (`/admin/data-quality`, extended): a new `data_quality_snapshots` table
  gets one row per issue per day, written when an admin actually opens the page — no cron job —
  and the page compares today's count to the closest snapshot ≥7 days old to show
  Increasing/Decreasing/Stable/New.
