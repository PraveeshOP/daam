# daam

A Nepal-focused price comparison MVP built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Run the validation suite with `npm run lint`, `npm run typecheck`, and `npm test`.

The app ships with realistic local seed data so it works immediately. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`, then run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor to connect the relational data layer.

The Supabase client is typed with the schema contract in [types/database.ts](types/database.ts). Regenerate that file from the Supabase CLI when the schema changes.

## Evo Store collector

The first manual collector targets Evo Store's public smartphone product URLs. Evo's `robots.txt` permits public product paths and its product sitemap exposes stable URLs and images. The collector uses product JSON-LD, waits 750ms between requests, and caps a run at 50 URLs.

Run a safe parser-only check with `npm run collect:evo -- --dry-run --limit=10`. Before the first write, run [supabase/migrations/20260819_add_offer_external_id.sql](supabase/migrations/20260819_add_offer_external_id.sql) in the Supabase SQL editor, add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`, and run `npm run collect:evo -- --limit=10`. Never commit the service-role key; it bypasses RLS and is server-only.

The second-store adapter targets ITTI's public product-detail API. Run `npm run collect:itti -- --dry-run --limit=10` to parse ten overlapping smartphone pages, or `npm run collect:itti -- --limit=10` to import them. Both collectors use the shared matcher in [collectors/core/matcher.ts](collectors/core/matcher.ts): high-confidence brand/model/storage matches reuse a canonical product, while medium-confidence matches are logged and kept separate.

## Automated price collection

Store collection now runs on a schedule instead of by hand. A separate worker process (`worker/`)
connects to Redis and Supabase, registers a [BullMQ](https://docs.bullmq.io) worker on the
`price-collection` queue, and runs the same collector/import logic as the manual scripts above —
`worker/processor.ts` calls the shared `runStoreCollection` helper in
[collectors/core/run.ts](collectors/core/run.ts), which every store collector implements through
the common `StoreCollector` interface in [collectors/core/types.ts](collectors/core/types.ts).

```text
Store A/B/C  →  Collector.collect()  →  BullMQ job (Redis)  →  Worker
                                                                   ↓
                                          matcher.ts → importer.ts (offers + price_history)
                                                                   ↓
                                                              Supabase → Website
```

Run it locally:

```bash
npm run redis:up      # starts Redis via Docker Compose (or run your own: brew install redis && redis-server)
npm run worker:dev    # starts the worker; registers one repeatable job per store
npm run queue:evo-store   # optional: manually enqueue a one-off run for a store
npm run queue:itti
```

- **Schedule**: every store collects on the interval in `COLLECTION_INTERVAL_HOURS` (default 6h).
  The worker uses BullMQ's `upsertJobScheduler`, which is idempotent by store id — restarting the
  worker updates the existing schedule instead of creating a duplicate.
- **Retries**: a failed store job retries up to 3 times with exponential backoff; one store failing
  never affects the others, since each store is its own job.
- **Concurrency**: a Redis lock (`worker/lock.ts`) keyed by store id prevents two collections for
  the same store from running at once (e.g. a manual trigger firing while the schedule is running);
  the second attempt is skipped, not queued or retried.
- **Timeouts**: every store request has a bounded timeout (`COLLECTOR_REQUEST_TIMEOUT_MS`) and the
  whole job has a hard ceiling (`COLLECTION_JOB_TIMEOUT_MS`, default 5 minutes) so a stalled store
  can't hang a worker slot forever.
- **Price history**: unchanged from the manual collectors — a new row is only written when the
  price actually differs from the most recent recorded price, so re-running a collector with no
  price changes never creates duplicate history rows.
- **Manual trigger without Redis**: `npm run collect:evo` / `npm run collect:itti` still run the
  collector directly against Supabase, no queue required — useful when Redis isn't running.

See [worker/README.md](worker/README.md) for the full environment variable reference and shutdown
behavior.

## GitHub Actions

Pull requests and pushes to `main` run lint, typecheck, and a production build through [CI](.github/workflows/ci.yml). The optional [Vercel deployment](.github/workflows/deploy.yml) runs after `main` pushes when the repository variable `ENABLE_VERCEL_DEPLOY` is set to `true` and `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` secrets are configured.

## Routes

- `/` home and popular comparisons
- `/search?q=iphone` search, sorting, and filters
- `/categories` category browse
- `/product/apple-iphone-16-128gb` product detail, offers, and history
- `/favorites` account placeholder
