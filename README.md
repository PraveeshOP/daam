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

## GitHub Actions

Pull requests and pushes to `main` run lint, typecheck, and a production build through [CI](.github/workflows/ci.yml). The optional [Vercel deployment](.github/workflows/deploy.yml) runs after `main` pushes when the repository variable `ENABLE_VERCEL_DEPLOY` is set to `true` and `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` secrets are configured.

## Routes

- `/` home and popular comparisons
- `/search?q=iphone` search, sorting, and filters
- `/categories` category browse
- `/product/apple-iphone-16-128gb` product detail, offers, and history
- `/favorites` account placeholder
