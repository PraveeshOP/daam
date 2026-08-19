# Accounts, favorites, and price alerts (phase 5)

## Auth

Supabase Auth handles sign up, login, logout, password reset, and session persistence —
no passwords are stored by this app. `lib/supabase/client.ts` (browser) and
`lib/supabase/server.ts` (Server Components/Actions) wrap `@supabase/ssr`; `proxy.ts` refreshes
the session cookie on every request (Next.js 16 renamed `middleware.ts` to `proxy.ts` — see
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).

Pages: `/login`, `/signup`, `/forgot-password`, `/reset-password`, plus `/auth/callback`
(a Route Handler that exchanges Supabase's email-link `code` for a session). Actions live in
`lib/auth/actions.ts`.

## Favorites and price alerts

Two new tables (`supabase/migrations/20260819_add_favorites_and_price_alerts.sql`):
`favorites` (unique per `user_id, product_id`) and `price_alerts` (`target_price`, `currency`,
`is_active`, `triggered_at`). Both have Row Level Security policies restricting every
select/insert/update/delete to `auth.uid() = user_id` — see that migration for the exact
policies. Server Actions (`app/actions/favorites.ts`, `app/actions/alerts.ts`) use the
session-scoped client from `lib/supabase/server.ts`, so RLS is what actually enforces
ownership, not just the action's own `.eq("user_id", ...)` filters.

## Price alert pipeline

`collectors/core/importer.ts` calls `lib/alerts/evaluate.ts#evaluateProductPriceAlerts` right
after it records a genuine price change (the same "did the price actually change" check that
already guards price_history writes) — this is the only place alerts are ever evaluated, so it
runs identically whether the price change came from the scheduled worker or a manual
`npm run collect:*` run.

`evaluateProductPriceAlerts`:
1. Recomputes the product's current lowest price across every store's offers.
2. Finds alerts where `is_active = true`, `triggered_at is null`, and `target_price >= lowest`.
3. Atomically claims each one (`update ... where is_active = true and triggered_at is null`) —
   the database row lock means two near-simultaneous evaluations of the same alert can never
   both claim it, which is what prevents a duplicate email when the price stays low across
   multiple collector runs.
4. Enqueues one small `notifications` BullMQ job per claim (`{ alertId, triggeredPrice }`).

The `notifications` queue is a second BullMQ `Worker` inside the same `worker/index.ts` process
(not a separate microservice — see `worker/notificationProcessor.ts`). It re-reads the alert,
product, and user email fresh from the database, sends the email
(`lib/email/priceAlert.ts` → `lib/email/client.ts`), and only then sets `is_active = false`
(the alert is now "Triggered" — see `lib/alerts/status.ts` for the Active/Triggered/Disabled
derivation). If sending throws, the alert is left untouched so BullMQ's retry/backoff can try
again; once every retry is exhausted, `worker/index.ts`'s `failed` handler releases the claim
(`triggered_at` back to `null`) so the next price change re-evaluates it from scratch instead of
it being stuck "in-flight" forever with no email ever sent.

An alert only re-arms when the user creates/edits it again (`createOrUpdateAlertAction` resets
`is_active = true, triggered_at = null` on upsert) — a price that goes back up and down again
after a successful trigger does not re-notify on its own, per spec.

## Email provider

`lib/email/client.ts` wraps [Resend](https://resend.com) behind `sendEmail()`. Configure
`RESEND_API_KEY` and `EMAIL_FROM`; without them, `sendEmail` throws (rather than silently
"succeeding") so a missing provider goes through the same failure/retry/release path as a real
outage instead of marking alerts triggered when no email was ever sent.
