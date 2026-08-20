-- "Most favorited" / "most alerted" (§9) read from the real favorites/price_alerts tables —
-- ground truth, not analytics_events — since a toggle-add-remove-add cycle in the event log
-- would otherwise double count what the tables already record accurately.

create or replace function most_favorited_products(p_limit int default 10)
returns table(product_id uuid, favorite_count bigint)
language sql
stable
as $$
  select product_id, count(*) as favorite_count
  from favorites
  group by product_id
  order by favorite_count desc
  limit p_limit;
$$;

create or replace function most_alerted_products(p_limit int default 10)
returns table(product_id uuid, alert_count bigint)
language sql
stable
as $$
  select product_id, count(*) as alert_count
  from price_alerts
  where is_active = true
  group by product_id
  order by alert_count desc
  limit p_limit;
$$;

grant execute on function most_favorited_products(int) to authenticated;
grant execute on function most_alerted_products(int) to authenticated;
