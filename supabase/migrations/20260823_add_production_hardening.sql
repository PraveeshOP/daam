-- Phase 9: production hardening (§H2, §H4, §H10 of the phase-9 audit)

-- §H2: the original `check (price >= 0)` allowed a scraped price of exactly zero straight into
-- offers/price_history. Both collectors already reject <= 0 in application code (see
-- collectors/evo/parser.ts, collectors/itti/parser.ts), so this is a defense-in-depth tightening,
-- not a behavior change — verified live that zero rows currently exist in either table. Adding a
-- second, more specific constraint rather than replacing the original by name (its
-- auto-generated name isn't guaranteed) — Postgres happily enforces both, and together they're
-- equivalent to `price > 0`.
alter table offers add constraint offers_price_positive_check check (price > 0);
alter table price_history add constraint price_history_price_positive_check check (price > 0);

-- §H4: getUserMetrics/getOutboundClickMetrics/etc. filter analytics_events by created_at alone
-- (no event_name predicate) for some queries — the existing (event_name, created_at) composite
-- index can't serve a created_at-only filter as its leading column. This is called on every
-- /admin/analytics page load.
create index if not exists analytics_events_created_idx on analytics_events (created_at desc);

-- §H10: `name.ilike.%term%` / `brand.ilike.%term%` (lib/data.ts searchProducts, lib/admin/
-- products.ts) is a leading-wildcard search, which a plain btree index on lower(column) (already
-- present, kept as-is) cannot serve — only prefix matches benefit from those. pg_trgm's GIN index
-- supports arbitrary substring ILIKE natively.
create extension if not exists pg_trgm;
create index if not exists products_name_trgm_idx on products using gin (name gin_trgm_ops);
create index if not exists products_brand_trgm_idx on products using gin (brand gin_trgm_ops);
