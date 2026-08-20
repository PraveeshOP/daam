# Affiliate / referral system (phase 8)

## What this is, and isn't

PriceNepal can earn a commission from some stores when a visitor clicks through and buys — but
the site still compares stores purely on price. Nothing in this phase changes what's shown as
the cheapest offer; it only changes where "Visit store" sends the browser once a visitor has
already decided which store to check out.

## Data model

Added in `supabase/migrations/20260822_add_affiliate_system.sql`, no new tables:

- `offers.affiliate_url` (nullable text) — the affiliate-network link for that specific offer, if
  one exists. Independent of `product_url`, which always stays the plain store link.
- `stores.affiliate_enabled` (boolean, default false) — whether this store's affiliate links may
  be used at all.
- `stores.partnership_status` (`none` | `pending` | `active` | `paused`, default `none`) — the
  commercial relationship's state. Only `active` partnerships have their affiliate links used;
  `pending`/`paused` behave exactly like `none` for redirect purposes, so pausing a partnership
  (e.g. a broken deal, an unpaid invoice) instantly and safely reverts every offer from that store
  to direct links without touching any offer row.
- `stores.affiliate_network` / `affiliate_tracking_id` — free-text admin notes (which network,
  what account) - not read by any redirect logic, purely informational.
- `stores.tracking_params` (jsonb) — query params appended to the affiliate URL (e.g. `utm_source`),
  never overwriting a param the affiliate URL already has.

No new RLS policies were needed: the phase-6 `for all using (is_admin())` policies on `stores`
and `offers` already cover every column on those tables, including these new ones. Verified
directly with the anon key (bypassing the UI and admin actions entirely) that writing any of
these columns as an unauthenticated client is silently rejected by Postgres.

## Destination resolution — `lib/stores/destination.ts`

`getStoreDestination(offer, store)` is the one function that decides where a click goes:

```
affiliate URL used only if:
  store.affiliateEnabled === true
  AND store.partnershipStatus === "active"
  AND offer.affiliateUrl is a well-formed http(s) URL
otherwise: offer.productUrl (the plain store link)
```

Every one of those conditions must hold; any single failure (disabled, paused, missing/malformed
URL) falls back to the direct link. The function takes no price, ranking, or sort-order
information at all — it has nothing to do with which offer is "the best price," only with where
a click on an already-chosen offer goes.

## The `/go/[offerId]` redirect — the only outbound-click boundary

The public site never links straight to a store or an affiliate network. Every "Visit store"
link points at `/go/{offer.id}` (`app/go/[offerId]/route.ts`), which:

1. Validates `offerId` looks like a UUID before touching the database at all.
2. Looks up the offer (and its store) by that id.
3. Resolves the destination via `getStoreDestination` — the destination is always derived from
   trusted database rows, **never** from anything the client supplies. This is what makes an
   open redirect structurally impossible here: there is no code path where a caller-provided URL
   ever reaches `NextResponse.redirect`.
4. Re-validates the resolved URL is genuinely `http(s)` as a second line of defense, then issues a
   302.
5. Records a `store_click` analytics event via `after()` — after the redirect response has
   already been sent, so a slow or failing analytics write never delays or blocks the click.

Safe fallbacks, all verified live against the real Supabase project:

| Input | Result |
|---|---|
| Valid direct offer | 302 → `product_url` |
| Valid affiliate offer (enabled, active, valid URL) | 302 → `affiliate_url` + tracking params |
| Offer with a malformed `affiliate_url` | 302 → `product_url` (silently falls back, logged) |
| Disabled offer (`is_disabled = true`) | redirect → home |
| Non-existent offer id | redirect → home |
| Non-UUID / path-traversal-shaped input | redirect → home, or 404 if it can't even match the route — never forwarded anywhere |

## Rate limiting on click recording

`lib/stores/clickRateLimit.ts` reuses the same Redis instance the price-collection queue already
depends on (no new infrastructure) to cap analytics writes per visitor to 20/minute. It only gates
whether a click is *recorded* — a burst of legitimate fast clicking, or a Redis hiccup, never
blocks the redirect itself; a real visitor should never be stopped from reaching the store because
analytics couldn't keep up.

## Ranking integrity

`lib/offers/ranking.ts` (`rankOffers`/`bestOffer`) is the single place offer order and "best
price" are computed, and it takes only `price` and `availability` — it has no affiliate/store
parameter at all, so there's no code path for a partnership to influence what shows as cheapest.
`lib/offers/ranking.test.ts` asserts this directly: a store with an active affiliate program and a
higher price never beats a cheaper store with no affiliate program at all.

## Admin controls

- **`/admin/stores/[id]`** — a "Affiliate / partnership" panel to set partnership status,
  toggle `affiliate_enabled`, and record the network/tracking id, plus a valid/invalid/none count
  of that store's offers' affiliate URLs.
- **`/admin/offers`** — an inline editor per offer for its `affiliate_url`, with a "Malformed"
  badge when the saved URL doesn't parse as http(s).
- **`/admin/analytics`** — an "Affiliate performance" section: total/affiliate/direct outbound
  clicks, broken down by store and by product, reusing the existing `store_click` event and the
  same `analytics_top_stores`/`analytics_top_products` RPCs the rest of analytics already uses —
  no separate tracking system. Purchases/revenue are shown as "Not available": PriceNepal only
  ever observes the outbound click, never whether it became a sale, and the dashboard says so
  rather than inventing a number.

All writes go through `assertAdmin()` and are recorded in `admin_audit_logs`, matching the
phase-6 pattern.

## Commercial disclosure

`OfferTable` shows "Some links may earn daam a commission at no additional cost to you"
whenever at least one visible offer would resolve to an affiliate link — computed the same way
the redirect route computes it, via `getStoreDestination`, so the disclosure can't drift out of
sync with what actually happens on click.
