# Worker process

A standalone Node process (run via `tsx`, same as the existing `collect:*` scripts — no build step
needed for local dev) that runs two BullMQ `Worker`s in one process: `price-collection` (scheduled
store collection) and `notifications` (price-alert emails). It does not serve any HTTP traffic;
the Next.js app is unaffected and keeps reading whatever is currently in Supabase.

## Files

| File | Responsibility |
| --- | --- |
| `queue.ts` | The `price-collection` Queue, job data shape (`{ storeId, category? }`), and default retry/backoff options. |
| `scheduler.ts` | Registers one repeatable job per store via BullMQ's `upsertJobScheduler` (idempotent — safe to call on every worker start). |
| `lock.ts` | Redis-based mutex keyed by `storeId` so the same store never collects twice concurrently. |
| `processor.ts` | The price-collection job handler: acquire lock → `runStoreCollection` (shared with the manual CLI scripts) → bounded timeout → release lock. |
| `notificationProcessor.ts` | The notifications job handler: re-reads the alert/product/user email, sends the price-alert email, and only then marks the alert triggered — see `docs/accounts-and-alerts.md`. |
| `index.ts` | Worker entrypoint: wires both queues/workers together, logs job state transitions, and shuts down gracefully on SIGINT/SIGTERM. |
| `trigger.ts` | `npm run queue:<store>` — enqueues one price-collection job through the real queue for manual/dev testing of the full pipeline. |

The shared Redis connection factory (`lib/queue/redis.ts`) and the `notifications` queue
(`lib/queue/notifications.ts`) live under `lib/` rather than `worker/` because the price-collection
pipeline itself enqueues notification jobs (`collectors/core/importer.ts` →
`lib/alerts/evaluate.ts`), not just this worker process.

## Running

```bash
npm run redis:up      # docker compose up -d redis
npm run worker:dev    # tsx worker/index.ts
```

Requires `REDIS_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` to be set (see
`.env.example`). The worker loads `.env.local` itself via `@next/env`, same as the collector
scripts — it does not need the Next.js dev server running. Sending real price-alert emails also
needs `RESEND_API_KEY`/`EMAIL_FROM`/`NEXT_PUBLIC_SITE_URL` — without them, alert detection and
retries still work, but the email step fails (by design — see `docs/accounts-and-alerts.md`).

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `REDIS_URL` | — (required) | Redis connection string, e.g. `redis://localhost:6379`. |
| `COLLECTION_INTERVAL_HOURS` | `6` | How often each store re-collects. Change and restart the worker — no code changes needed. |
| `WORKER_CONCURRENCY` | `2` | Max price-collection jobs (i.e. different stores) processed at once. |
| `NOTIFICATION_WORKER_CONCURRENCY` | `5` | Max notification (email) jobs processed at once — higher than collection concurrency since sending an email is much cheaper than scraping a store. |
| `COLLECTION_PRODUCT_LIMIT` | `20` | Products fetched per store per run (each collector still caps this at its own safe maximum). |
| `COLLECTION_JOB_TIMEOUT_MS` | `300000` (5m) | Hard ceiling for one store's job before it's treated as failed/hung and retried. |
| `COLLECTOR_REQUEST_TIMEOUT_MS` | `15000` | Per-HTTP-request timeout used by every collector. |
| `RESEND_API_KEY` / `EMAIL_FROM` | — | Email provider for price-alert notifications (see `lib/email/client.ts`). |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Used to build the "View Product" link in alert emails and Supabase auth email redirects. |

## Shutdown

On `SIGINT`/`SIGTERM` the worker stops accepting new jobs on both queues, waits for the active
job(s) to finish, then closes both BullMQ Workers/Queues and all Redis connections before exiting
— safe to redeploy or restart without losing an in-flight collection or notification.
