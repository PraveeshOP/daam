-- Phase 7: product analytics events + a lightweight data-quality trend table.
-- System observability (traces/metrics) is handled by OpenTelemetry in application code, not
-- the database — see lib/otel/. Store-collection health itself already reads BullMQ job history
-- directly (lib/admin/collections.ts, phase 6); nothing here duplicates that.

-- ============================================================================
-- 1. analytics_events
-- ============================================================================

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in (
    'search', 'product_view', 'store_click',
    'favorite_added', 'favorite_removed',
    'price_alert_created', 'price_alert_deleted', 'price_alert_triggered'
  )),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text,
  product_id uuid references products(id) on delete set null,
  store_id uuid references stores(id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Query patterns: "events of type X since date" (dashboard widgets, top-N aggregates), and
-- "events for this product/store" (per-product/per-store analytics). No index on user_id or
-- anonymous_id — nothing in this phase looks events up by visitor, only aggregates by type/date.
create index if not exists analytics_events_name_created_idx on analytics_events (event_name, created_at desc);
create index if not exists analytics_events_product_idx on analytics_events (product_id) where product_id is not null;
create index if not exists analytics_events_store_idx on analytics_events (store_id) where store_id is not null;

alter table analytics_events enable row level security;
drop policy if exists "Admins can read analytics events" on analytics_events;
create policy "Admins can read analytics events" on analytics_events for select using (is_admin());
-- Deliberately no insert/update/delete policy for anon or authenticated: every event is written
-- through the service-role client from a Server Action (lib/analytics/track.ts) that has
-- already computed event_name/properties itself — the public anon key can never write directly
-- to this table, so there's no way to spam or forge analytics rows via the REST API.

-- ============================================================================
-- 2. Aggregate read functions used by /admin/analytics.
--
-- Plain SQL functions (not security definer) — they run as the calling role, so the RLS policy
-- above still applies: a non-admin session gets zero rows back from these, an admin session
-- gets real aggregates. GROUP BY isn't expressible through the supabase-js query builder, hence
-- functions instead of hand-aggregating rows fetched into JS.
-- ============================================================================

create or replace function analytics_top_searches(p_since timestamptz, p_limit int default 10, p_zero_results_only boolean default false)
returns table(query text, search_count bigint)
language sql
stable
as $$
  select properties->>'query' as query, count(*) as search_count
  from analytics_events
  where event_name = 'search'
    and created_at >= p_since
    and properties->>'query' is not null
    and (not p_zero_results_only or coalesce((properties->>'result_count')::int, 0) = 0)
  group by properties->>'query'
  order by search_count desc
  limit p_limit;
$$;

create or replace function analytics_top_products(p_since timestamptz, p_event_name text, p_limit int default 10)
returns table(product_id uuid, event_count bigint)
language sql
stable
as $$
  select product_id, count(*) as event_count
  from analytics_events
  where event_name = p_event_name
    and created_at >= p_since
    and product_id is not null
  group by product_id
  order by event_count desc
  limit p_limit;
$$;

create or replace function analytics_top_stores(p_since timestamptz, p_limit int default 10)
returns table(store_id uuid, click_count bigint)
language sql
stable
as $$
  select store_id, count(*) as click_count
  from analytics_events
  where event_name = 'store_click'
    and created_at >= p_since
    and store_id is not null
  group by store_id
  order by click_count desc
  limit p_limit;
$$;

create or replace function analytics_daily_counts(p_since timestamptz, p_event_name text)
returns table(day date, event_count bigint)
language sql
stable
as $$
  select date_trunc('day', created_at)::date as day, count(*) as event_count
  from analytics_events
  where event_name = p_event_name and created_at >= p_since
  group by day
  order by day;
$$;

grant execute on function analytics_top_searches(timestamptz, int, boolean) to authenticated;
grant execute on function analytics_top_products(timestamptz, text, int) to authenticated;
grant execute on function analytics_top_stores(timestamptz, int) to authenticated;
grant execute on function analytics_daily_counts(timestamptz, text) to authenticated;

-- ============================================================================
-- 3. Data-quality trend snapshots (§24: "Increasing / Stable / Decreasing").
--
-- Written by the admin dashboard itself (lib/admin/dataQuality.ts), at most once per issue per
-- day, when an admin actually views /admin/data-quality — not on a schedule, so this needs no
-- new cron job, and it never grows faster than "a handful of rows per day this table has ever
-- had admin eyes on it".
-- ============================================================================

create table if not exists data_quality_snapshots (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null,
  issue_count integer not null,
  created_at timestamptz not null default now()
);

create index if not exists data_quality_snapshots_key_created_idx on data_quality_snapshots (issue_key, created_at desc);

alter table data_quality_snapshots enable row level security;
drop policy if exists "Admins can manage data quality snapshots" on data_quality_snapshots;
create policy "Admins can manage data quality snapshots" on data_quality_snapshots for all using (is_admin()) with check (is_admin());
