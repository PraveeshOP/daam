create extension if not exists "pgcrypto";

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  website_url text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  brand text not null,
  category_id uuid references categories(id),
  description text,
  image_url text,
  specifications jsonb not null default '{}'::jsonb,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),
  previous_price numeric(12,2),
  currency text not null default 'NPR',
  availability text not null default 'in_stock' check (availability in ('in_stock', 'out_of_stock')),
  product_url text not null,
  last_checked timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, store_id)
);

create table if not exists price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  store_id uuid references stores(id) on delete set null,
  price numeric(12,2) not null check (price >= 0),
  recorded_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table stores enable row level security;
alter table products enable row level security;
alter table offers enable row level security;
alter table price_history enable row level security;

create policy "Public can read categories" on categories for select using (true);
create policy "Public can read stores" on stores for select using (true);
create policy "Public can read products" on products for select using (true);
create policy "Public can read offers" on offers for select using (true);
create policy "Public can read price history" on price_history for select using (true);

insert into categories (name, slug) values
  ('Smartphones', 'smartphones'), ('Laptops', 'laptops'), ('Audio', 'audio'), ('TVs', 'televisions'),
  ('Cameras', 'cameras'), ('Gaming', 'gaming'), ('Smartwatches', 'smartwatches'), ('Home appliances', 'home-appliances')
on conflict (slug) do nothing;

insert into stores (name, slug, website_url) values
  ('Evo Store', 'evo-store', 'https://evostore.com.np'), ('Hukut', 'hukut', 'https://hukut.com'),
  ('Mudita Store', 'mudita-store', 'https://mudita.com.np'), ('Oliz Store', 'oliz-store', 'https://olizstore.com'),
  ('ITTI', 'itti', 'https://itti.com.np')
on conflict (slug) do nothing;

-- Product and offer rows can be inserted from the accompanying seed workflow.
-- The app includes a local seed fallback so the MVP remains usable before Supabase credentials are added.
