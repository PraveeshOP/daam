# Price collection worker

A standalone Node process (run via `tsx`, same as the existing `collect:*` scripts — no build step
needed for local dev) that turns scheduled/manual store collection into BullMQ jobs on a
`price-collection` queue backed by Redis. It does not serve any HTTP traffic; the Next.js app is
unaffected and keeps reading whatever is currently in Supabase.

## Files

| File | Responsibility |
| --- | --- |
| `redis.ts` | Creates/reuses Redis (ioredis) connections. One dedicated connection for the Worker, one shared connection for the Queue/scheduler — never one per job. |
| `queue.ts` | The `price-collection` Queue, job data shape (`{ storeId, category? }`), and default retry/backoff options. |
| `scheduler.ts` | Registers one repeatable job per store via BullMQ's `upsertJobScheduler` (idempotent — safe to call on every worker start). |
| `lock.ts` | Redis-based mutex keyed by `storeId` so the same store never collects twice concurrently. |
| `processor.ts` | The actual job handler: acquire lock → `runStoreCollection` (shared with the manual CLI scripts) → bounded timeout → release lock. |
| `index.ts` | Worker entrypoint: wires the above together, logs job state transitions, and shuts down gracefully on SIGINT/SIGTERM. |
| `trigger.ts` | `npm run queue:<store>` — enqueues one job through the real queue for manual/dev testing of the full pipeline. |

## Running

```bash
npm run redis:up      # docker compose up -d redis
npm run worker:dev    # tsx worker/index.ts
```

Requires `REDIS_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` to be set (see
`.env.example`). The worker loads `.env.local` itself via `@next/env`, same as the collector
scripts — it does not need the Next.js dev server running.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `REDIS_URL` | — (required) | Redis connection string, e.g. `redis://localhost:6379`. |
| `COLLECTION_INTERVAL_HOURS` | `6` | How often each store re-collects. Change and restart the worker — no code changes needed. |
| `WORKER_CONCURRENCY` | `2` | Max jobs (i.e. different stores) processed at once by this worker process. |
| `COLLECTION_PRODUCT_LIMIT` | `20` | Products fetched per store per run (each collector still caps this at its own safe maximum). |
| `COLLECTION_JOB_TIMEOUT_MS` | `300000` (5m) | Hard ceiling for one store's job before it's treated as failed/hung and retried. |
| `COLLECTOR_REQUEST_TIMEOUT_MS` | `15000` | Per-HTTP-request timeout used by every collector. |

## Shutdown

On `SIGINT`/`SIGTERM` the worker stops accepting new jobs, waits for the active job(s) to finish,
then closes the BullMQ Worker/Queue and both Redis connections before exiting — safe to redeploy
or restart without losing an in-flight collection.
