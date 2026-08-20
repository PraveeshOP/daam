# Admin dashboard (phase 6)

## Making yourself an administrator

There is deliberately no self-service "become an admin" button or API — every account is created
as `role = 'user'` (via a trigger on `auth.users`, see the phase-6 migration) and promotion only
happens by direct SQL. Sign up normally, then in the Supabase SQL editor (or `supabase db
execute` if linked):

```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

Log out and back in (or just refresh) and `/admin` will show the dashboard instead of "Access
denied".

## Authorization

`lib/admin/auth.ts` is the one place that decides who's an admin, backed by the `profiles` table
and `is_admin()` SQL function added in `supabase/migrations/20260820_add_admin_dashboard.sql`:

- `getAdminSession()` — used by `app/admin/layout.tsx` to render one of three things: a login
  prompt, an "Access denied" screen, or the dashboard. This is the page-level gate.
- `assertAdmin()` — used by every Server Action under `app/admin/actions/`. A Server Action is a
  public POST endpoint reachable without ever rendering the layout, so page-level gating alone
  is not a security boundary — every mutation re-checks independently.
- **Row Level Security is the actual enforcement**, not the frontend or even the Server Action's
  own check: `products`, `stores`, and `offers` gained `for all using (is_admin())` policies:
  normal users still only get the pre-existing public `select` policy, so even a forged request
  straight to Supabase's REST API from a non-admin session is rejected by Postgres itself. This
  was verified directly (bypassing the UI and the Server Actions entirely) — see the phase-6
  testing notes in the final report.

## Product matching review

Previously, a "medium confidence" match from `collectors/core/matcher.ts` was only logged to the
console for the duration of one collection run, then silently forgotten (a duplicate product
just stayed a duplicate forever). `product_match_candidates` now persists that signal, and
`/admin/matches` is the review queue:

- **Accept** calls the `accept_product_match(candidate_id)` Postgres function, which moves the
  duplicate's offers/price history/favorites/alerts onto the canonical product (resolving the
  rare case where both already have an offer from the same store by keeping the canonical one)
  and marks the duplicate `status = 'inactive'` with `merged_into` set — never deleted, so its
  price history stays available to admins.
- **Keep separate** calls `reject_product_match(candidate_id)`, which just marks the candidate
  resolved. No data moves.
- Both functions read the acting admin's identity from `auth.uid()` inside the function itself
  (not a parameter the client could forge) and refuse to run at all unless `is_admin()` is true.

## Collections and store health

`/admin/collections` and the store health badges on `/admin/stores` read directly from the
existing `price-collection` BullMQ queue's job history (`lib/admin/collections.ts`) — there is no
second "collection runs" table. A store is "Failing" if its most recent job outright failed, or
if its last successful collection is older than 4x `COLLECTION_INTERVAL_HOURS` (the same
staleness rule `/admin/data-quality` uses for stale offers); a handful of per-product errors on
an otherwise-successful run does not flip a store to "Failing" on its own.

## What's read-only vs. what changes data

Read-only dashboards (`/admin`, `/admin/collections`, `/admin/data-quality`, `/admin/audit-log`)
never write anything. Every mutating action — edit/disable a product, disable/mark an offer,
accept/reject a match, trigger a collection — is recorded in `admin_audit_logs` with the real
admin's `auth.uid()`, and none of them delete rows; products and offers gain a `status`/
`is_disabled` flag instead.
