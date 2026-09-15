-- Phase 5: user accounts, favorites, and price alerts.
-- Users themselves live in Supabase Auth's built-in auth.users; no separate profiles table
-- is needed yet since the account page only needs the email/created_at auth already stores.

create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  target_price numeric(12,2) not null check (target_price > 0),
  currency text not null default 'NPR',
  is_active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- Indexes driven by the actual query patterns:
-- - favorites/price_alerts are always listed "for the current user" -> user_id lookups.
--   The unique(user_id, product_id) constraint above already gives a btree with user_id as
--   the leading column, so a separate favorites.user_id index would be redundant; price_alerts
--   gets an explicit one below since its unique index alone wouldn't help a plain user_id scan
--   as cheaply once the table has many rows per user across differently-ordered queries.
-- - The price pipeline's alert check queries "active alerts for this product" -> a composite
--   (product_id, is_active) index serves that exactly, without a separate is_active-only index
--   (a boolean column is a poor index on its own — most rows share the same value).
create index if not exists price_alerts_user_id_idx on price_alerts (user_id);
create index if not exists price_alerts_product_active_idx on price_alerts (product_id, is_active);
create index if not exists favorites_product_id_idx on favorites (product_id);

alter table favorites enable row level security;
alter table price_alerts enable row level security;

drop policy if exists "Users can view own favorites" on favorites;
drop policy if exists "Users can add own favorites" on favorites;
drop policy if exists "Users can remove own favorites" on favorites;
drop policy if exists "Users can view own alerts" on price_alerts;
drop policy if exists "Users can create own alerts" on price_alerts;
drop policy if exists "Users can update own alerts" on price_alerts;
drop policy if exists "Users can delete own alerts" on price_alerts;

-- Favorites: a user may only see/create/delete their own rows. No update policy — favoriting
-- is a toggle (insert/delete), there is nothing on the row itself to edit.
create policy "Users can view own favorites" on favorites
  for select using (auth.uid() = user_id);
create policy "Users can add own favorites" on favorites
  for insert with check (auth.uid() = user_id);
create policy "Users can remove own favorites" on favorites
  for delete using (auth.uid() = user_id);

-- Price alerts: a user may only see/create/update/delete their own rows. The price-pipeline
-- worker evaluates and triggers alerts using the service-role key, which bypasses RLS by
-- design (a trusted server process, never reachable from the browser).
create policy "Users can view own alerts" on price_alerts
  for select using (auth.uid() = user_id);
create policy "Users can create own alerts" on price_alerts
  for insert with check (auth.uid() = user_id);
create policy "Users can update own alerts" on price_alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own alerts" on price_alerts
  for delete using (auth.uid() = user_id);
