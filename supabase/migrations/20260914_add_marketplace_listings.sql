-- C2C marketplace listings (HamroBazaar today), kept deliberately apart from the retail
-- `offers` / `price_history` tables.
--
-- "Marketplace" here means many independent sellers rather than one retailer's catalogue; it does
-- not mean "used". Condition is a column precisely because a collector may narrow to sealed stock
-- (HamroBazaar's currently stores `brand_new` only) without the schema assuming either way.
--
-- Why not just add another store row and reuse `offers`:
--   1. `offers` is unique(product_id, store_id). On a classifieds site fifty different people
--      sell the same "iPhone 13 128GB" at fifty different prices; they would all collapse into
--      one row and each import would overwrite the last, leaving an effectively arbitrary price.
--   2. Used-goods prices sit far below retail, so once matched onto a canonical product a
--      marketplace source becomes permanently "cheapest" and distorts every comparison shown.
--   3. Listing titles are seller-written free text ("Urgent sales", "Car for sale"), which would
--      pollute the canonical `products` catalogue.
--
-- `product_id` is nullable and left null by the collector: linking a listing to a canonical
-- product is a separate, deliberate step, never a guess made during import.
--
-- Note on what is *absent*: the source payload exposes each seller's name and phone number
-- (`creatorInfo.createdByName` / `createdByUsername`), and seller-written descriptions commonly
-- embed a contact number. None of it is needed to compare prices, so this table has no column to
-- put it in and the parser drops it before it ever reaches here. Please keep it that way.

create table if not exists marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  -- Marketplace slug, e.g. 'hamrobazaar'. Not a FK to `stores`: these are not retail stores and
  -- must not show up anywhere `stores` is enumerated as a price-comparison source.
  source text not null,
  -- The marketplace's own listing id, which is what makes many listings per model possible.
  external_id text not null,
  product_id uuid references products(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  title text not null,
  -- The marketplace's own category label, kept verbatim for filtering and attribution.
  source_category text,
  brand text,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'NPR',
  condition text not null default 'unknown' check (condition in ('brand_new', 'like_new', 'used', 'unknown')),
  negotiable boolean not null default false,
  listing_url text not null,
  image_url text,
  -- When the seller posted the advert, per the source.
  posted_at timestamptz,
  -- Set once on insert; never rewritten, so it keeps meaning "when we first saw this advert".
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(source, external_id)
);

create index if not exists marketplace_listings_source_seen_idx on marketplace_listings (source, last_seen_at desc);
create index if not exists marketplace_listings_product_idx on marketplace_listings (product_id) where product_id is not null;
create index if not exists marketplace_listings_category_price_idx on marketplace_listings (source_category, price);

alter table marketplace_listings enable row level security;

-- `create policy` has no `if not exists`, so the drop keeps this file re-runnable the way every
-- `create table/index if not exists` above it already is. Matches supabase/schema.sql.
drop policy if exists "Public can read marketplace listings" on marketplace_listings;

create policy "Public can read marketplace listings" on marketplace_listings for select using (true);
