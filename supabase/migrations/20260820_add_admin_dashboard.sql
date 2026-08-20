-- Phase 6: admin dashboard and data quality.

-- ============================================================================
-- 1. Profiles + role, mirroring auth.users so RLS policies (and a plain
--    `select count(*) from profiles` for the admin dashboard's "Users" metric)
--    don't need the service-role-only auth.admin API.
-- ============================================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill any users created before this migration (phases 4/5 test accounts, if any remain).
insert into profiles (id, role)
select id, 'user' from auth.users
on conflict (id) do nothing;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'user');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- security definer + stable, so it can be used inside RLS policies (including on `profiles`
-- itself) without recursively re-triggering the RLS it's helping evaluate.
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

alter table profiles enable row level security;
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Admins can view all profiles" on profiles;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Admins can view all profiles" on profiles for select using (is_admin());
-- No insert/update/delete policy for anon/authenticated: profiles are created only by the
-- trigger above, and role changes are deliberately admin-only via direct SQL/service-role —
-- there's no self-service "become an admin" path, and no admin-user-management UI in this phase.

-- ============================================================================
-- 2. Product status (soft-disable instead of deleting) + a trail for merged
--    duplicates from the match-review workflow.
-- ============================================================================

alter table products add column if not exists status text not null default 'active' check (status in ('active', 'inactive'));
alter table products add column if not exists merged_into uuid references products(id);
create index if not exists products_status_idx on products (status);

-- Offers: a separate "disabled" flag from `availability` (in_stock/out_of_stock already reflects
-- what the collector observed; `is_disabled` is an admin-only override to hide a bad listing from
-- the public site without losing its price history).
alter table offers add column if not exists is_disabled boolean not null default false;
create index if not exists offers_last_checked_idx on offers (last_checked);

-- ============================================================================
-- 3. Admin write access to the tables that were previously service-role-only.
--    (Public/authenticated select policies already existed and are unchanged.)
-- ============================================================================

drop policy if exists "Admins can modify products" on products;
drop policy if exists "Admins can modify stores" on stores;
drop policy if exists "Admins can modify offers" on offers;
create policy "Admins can modify products" on products for all using (is_admin()) with check (is_admin());
create policy "Admins can modify stores" on stores for all using (is_admin()) with check (is_admin());
create policy "Admins can modify offers" on offers for all using (is_admin()) with check (is_admin());

-- Admins additionally need to see other users' favorites/alerts to compute per-product stats
-- (section 21: "Active alerts: 17, Favorites: 82") — read-only, on top of each user's own policy.
drop policy if exists "Admins can view all favorites" on favorites;
drop policy if exists "Admins can view all alerts" on price_alerts;
create policy "Admins can view all favorites" on favorites for select using (is_admin());
create policy "Admins can view all alerts" on price_alerts for select using (is_admin());

-- ============================================================================
-- 4. Product match candidates — persists the matcher's "uncertain" results
--    (previously only logged to the console) so they can be reviewed in
--    /admin/matches instead of silently creating a duplicate product forever.
-- ============================================================================

create table if not exists product_match_candidates (
  id uuid primary key default gen_random_uuid(),
  new_product_id uuid not null references products(id) on delete cascade,
  candidate_product_id uuid not null references products(id) on delete cascade,
  store_id uuid references stores(id) on delete set null,
  confidence numeric(5,2) not null,
  reasons text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (new_product_id, candidate_product_id)
);

create index if not exists match_candidates_status_idx on product_match_candidates (status, created_at desc);

alter table product_match_candidates enable row level security;
drop policy if exists "Admins can manage match candidates" on product_match_candidates;
create policy "Admins can manage match candidates" on product_match_candidates for all using (is_admin()) with check (is_admin());
-- Deliberately no public/authenticated policy: match candidates are an internal review queue,
-- not something a normal user (or even a logged-in one) has any reason to read.

-- ============================================================================
-- 5. Admin audit log — lightweight, append-only.
-- ============================================================================

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx on admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_admin_idx on admin_audit_logs (admin_user_id);

alter table admin_audit_logs enable row level security;
drop policy if exists "Admins can read audit logs" on admin_audit_logs;
drop policy if exists "Admins can write own audit logs" on admin_audit_logs;
create policy "Admins can read audit logs" on admin_audit_logs for select using (is_admin());
create policy "Admins can write own audit logs" on admin_audit_logs for insert
  with check (is_admin() and admin_user_id = auth.uid());
-- No update/delete policy for anyone — an audit log that can be edited or removed isn't one.

-- ============================================================================
-- 6. Accept/reject match — atomic, admin-only, identity taken from auth.uid()
--    (never trusted from the caller).
-- ============================================================================

create or replace function reject_product_match(p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  update product_match_candidates
  set status = 'rejected', decided_by = auth.uid(), decided_at = now()
  where id = p_candidate_id and status = 'pending';

  if not found then
    raise exception 'match candidate not found or already decided';
  end if;
end;
$$;

create or replace function accept_product_match(p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_product_id uuid;
  v_candidate_product_id uuid;
  v_status text;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  select new_product_id, candidate_product_id, status
    into v_new_product_id, v_candidate_product_id, v_status
    from product_match_candidates
    where id = p_candidate_id
    for update;

  if v_new_product_id is null then
    raise exception 'match candidate not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'match candidate already decided';
  end if;

  -- Move price history unconditionally — no uniqueness constraint to conflict with, and every
  -- recorded price is real regardless of which of the two product rows it was attached to.
  update price_history set product_id = v_candidate_product_id where product_id = v_new_product_id;

  -- Offers are unique per (product_id, store_id): if the canonical product already has an offer
  -- from a store that also has one on the duplicate, keep the canonical one and drop the
  -- duplicate rather than violate the constraint.
  delete from offers o
    where o.product_id = v_new_product_id
      and exists (
        select 1 from offers o2
        where o2.product_id = v_candidate_product_id and o2.store_id = o.store_id
      );
  update offers set product_id = v_candidate_product_id where product_id = v_new_product_id;

  -- Same idea for favorites and price alerts, both unique per (user_id, product_id).
  delete from favorites f
    where f.product_id = v_new_product_id
      and exists (
        select 1 from favorites f2
        where f2.product_id = v_candidate_product_id and f2.user_id = f.user_id
      );
  update favorites set product_id = v_candidate_product_id where product_id = v_new_product_id;

  delete from price_alerts pa
    where pa.product_id = v_new_product_id
      and exists (
        select 1 from price_alerts pa2
        where pa2.product_id = v_candidate_product_id and pa2.user_id = pa.user_id
      );
  update price_alerts set product_id = v_candidate_product_id where product_id = v_new_product_id;

  -- Retire the duplicate rather than delete it — its price history is still valid history for
  -- the (now single) canonical product, and merged_into keeps a trail of what happened to it.
  update products
    set status = 'inactive', merged_into = v_candidate_product_id, updated_at = now()
    where id = v_new_product_id;

  update product_match_candidates
    set status = 'accepted', decided_by = auth.uid(), decided_at = now()
    where id = p_candidate_id;
end;
$$;

revoke all on function accept_product_match(uuid) from public, anon;
revoke all on function reject_product_match(uuid) from public, anon;
grant execute on function accept_product_match(uuid) to authenticated;
grant execute on function reject_product_match(uuid) to authenticated;
