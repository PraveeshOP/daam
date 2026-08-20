-- Phase 8: store referral/affiliate foundation.
-- No new RLS policies needed: offers/stores already have public-read + admin-write-all policies
-- (phase 6) that cover these new columns automatically.

-- Per-offer affiliate deep link. Nullable — most stores won't have one, and the offer's existing
-- product_url remains the fallback (lib/stores/destination.ts).
alter table offers add column if not exists affiliate_url text;

-- Store-level partnership configuration. Deliberately no commission/revenue columns yet (§4:
-- "do not store unnecessary sensitive commercial information") — those can be added later
-- without touching this shape.
alter table stores add column if not exists affiliate_enabled boolean not null default false;
alter table stores add column if not exists partnership_status text not null default 'none' check (partnership_status in ('none', 'pending', 'active', 'paused'));
alter table stores add column if not exists affiliate_network text;
alter table stores add column if not exists affiliate_tracking_id text;
-- Arbitrary extra query parameters a specific affiliate network requires (ref, utm_source, ...)
-- — different networks need different params, so this stays a flexible map rather than fixed
-- columns (§18).
alter table stores add column if not exists tracking_params jsonb not null default '{}'::jsonb;
