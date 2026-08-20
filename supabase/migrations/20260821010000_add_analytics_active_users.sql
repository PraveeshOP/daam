-- Small follow-up to 20260821_add_analytics.sql: "Active users" (§12) needs a distinct count,
-- which isn't expressible through the supabase-js query builder any more than the other
-- aggregates in that migration were.

create or replace function analytics_active_users(p_since timestamptz)
returns bigint
language sql
stable
as $$
  select count(distinct user_id) from analytics_events where created_at >= p_since and user_id is not null;
$$;

grant execute on function analytics_active_users(timestamptz) to authenticated;
