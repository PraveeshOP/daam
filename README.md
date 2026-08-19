# daam

A Nepal-focused price comparison MVP built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app ships with realistic local seed data so it works immediately. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`, then run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor to connect the relational data layer.

## GitHub Actions

Pull requests and pushes to `main` run lint, typecheck, and a production build through [CI](.github/workflows/ci.yml). The optional [Vercel deployment](.github/workflows/deploy.yml) runs after `main` pushes when the repository variable `ENABLE_VERCEL_DEPLOY` is set to `true` and `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` secrets are configured.

## Routes

- `/` home and popular comparisons
- `/search?q=iphone` search, sorting, and filters
- `/categories` category browse
- `/product/apple-iphone-16-128gb` product detail, offers, and history
- `/favorites` account placeholder
