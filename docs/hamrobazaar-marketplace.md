# Adding a marketplace: HamroBazaar

Every previous integration (see `docs/mobilemandu-integration.md`) added a *retail store*: a shop
with a fixed catalogue, one price per product, reusing `StoreCollector` → `runStoreCollection` →
`importStoreProduct` with no changes to any of it.

HamroBazaar is not that. It is Nepal's largest **C2C classifieds marketplace** — many independent
sellers, each advertising one item, rather than one retailer with a catalogue. This document
records what that changed and why, because the differences are the reason this integration touches
core files at all.

**Scope: the collector stores `brand_new` listings only** (see "What is collected" below). The
table and the `condition` column stay open to every condition so that narrowing is a collector's
decision rather than something baked into the schema.

## Why it could not reuse `offers`

Three findings, each verified against the live site before any code was written:

1. **`offers` is `unique(product_id, store_id)`.** On a classifieds site many different people
   sell the same model at different prices. Through the retail path they would all collapse into a
   single offer row, each import overwriting the last, so the stored price would be whichever
   listing happened to be processed last. **This still bites after the brand-new-only filter**: one
   sampled run returned three separate sealed "MacBook Pro M5" listings at NPR 435,000 / 364,999 /
   334,999 — three real competing prices that `offers` could only store as one.
2. **Seller-set prices undercut retail.** Once matched onto a canonical product at the matcher's
   ≥75% confidence threshold, the marketplace becomes permanently the cheapest "store" for
   everything it touches, and every comparison on the site would point at it. The brand-new filter
   reduces this but does not remove it — a reseller's sealed stock still routinely undercuts a
   shopfront's price.
3. **Titles are seller-written free text.** Real examples from one feed: "Urgent sales", "Car for
   sale", "Volkswagen" priced at NPR 35. Creating canonical `products` rows from these pollutes
   the catalogue irreversibly.

So listings go to their own table, `marketplace_listings`
(`supabase/migrations/20260914_add_marketplace_listings.sql`), keyed by the source's own listing
id. `product_id` is nullable and the collector leaves it null: linking a listing to a canonical
product is a later, deliberate decision, never a guess made at import time. Nothing on this path
writes `offers` or `price_history`.

## What robots.txt allows, and what that forces

`hamrobazaar.com/robots.txt` (read before writing the collector):

```
Allow: /  /detail/  /category/  /search/product  ...
Disallow: /api/  /profile  /settings  /boost/  /login
```

That `Disallow: /api/` is the constraint that shapes the whole collector. Verified live:

- `/category/<slug>/<guid>` and `/search/product?q=…` server-render only their subcategory chrome.
  The listing grid is fetched **client-side from `/api/…`** — the disallowed prefix. The client
  bundle contains no absolute API host at all, only relative `/api/...` paths, so there is no
  separate host to fall back to.
- The **homepage is allowed and does server-render listings**: its React Server Component flight
  payload carried **80 complete listing objects across 19 categories** in one fetch, including
  Mobile Phone Handsets, Laptops, Televisions, Storage and Headphones.
- `/detail/<guid>` is allowed and returns the listing title server-rendered, with the price in
  `og:description`. The site's own canonical is longer
  (`/detail/{category}/{title}-in-{location}/{guid}`) but the short form resolves to the same page.

**Consequence:** there is no robots-clean way to page through a category. The collector makes one
request per run to the site root and accumulates coverage across scheduled runs, rather than
sweeping a category in one pass. It is not a crawler and has no page 2.

## Payload notes (all verified live, 2026-09-14)

- The flight payload is split across ~164 `self.__next_f.push([1,"<json string literal>"])` calls
  and **a single listing routinely straddles a chunk boundary**. Every chunk must be unescaped and
  concatenated before anything is extracted. Scanning the raw HTML for the doubly-escaped
  `\"price\":` form instead finds only the listings that happen to fall inside one chunk — that
  mistake undercounted this same page as 30 listings when it really carried 80.
- `condition` is a 1–3 enum: 1 = Brand New, 2 = Like New, 3 = Used, confirmed by the sibling
  `badge.text` the site renders. Anything else maps to `unknown`.
- `brandName` was **empty on all 80 listings sampled**, so brand is carried through as undefined
  rather than defaulted to a made-up value.
- Sellers price cars in **lakhs** ("Honda WR-V … 28.5", "Mahindra XUV500 … 31.5" — both real). A
  low figure is therefore a unit convention, not a typo. Nothing is rescaled: guessing which
  listings meant lakh would corrupt the honest ones. Only non-positive/non-finite prices are
  rejected.
- Listing titles carry reseller padding: the same phrase repeated behind `>>`
  ("Macbook Pro M5 24/1TB>>Macbook Pro M5 24/1TB>>"), on 5 of 12 collected listings. The text
  before the first `>>` is the real title in every case sampled, so `cleanListingTitle` keeps that
  and drops the rest. The trigger is `>>` specifically — a lone `>` plausibly appears in a genuine
  title ("Type-C > HDMI"), and splitting on that would truncate real names.
- A useful surprise: many listings are `brand_new` sealed stock from small resellers using
  HamroBazaar as a storefront, not only used goods. That is the half of the feed this collector
  keeps.

## What is collected

Two filters are applied, both at parse time:

- **Category** — `HAMROBAZAAR_ELECTRONICS_CATEGORIES`, the 11 consumer-electronics labels observed
  live. The homepage feed is chronological across the whole site, so one fetch also carries Cars,
  For Rent - House, Pet - Dogs and Men's Grooming Tools.
- **Condition** — `HAMROBAZAAR_WANTED_CONDITIONS`, currently `["brand_new"]` only.

`like_new` is **not** treated as new. Despite the name it is the site's condition 2, which is
used-but-good — the site itself renders it as a "Like New" badge alongside "Brand New" and "Used" —
so including it would quietly re-admit used goods. A test pins this.

Neither filter counts toward `skipped`, which stays a signal that the source's payload shape has
drifted rather than a count of things we chose to ignore.

One live run after filtering: 12 sealed listings — MacBook Pro M5 (three variants), iPhone 17
256GB, Galaxy S26 Ultra 256GB, JBL/SanDisk/UGREEN accessories.

## Seller personal data is deliberately dropped

Each raw listing carries `creatorInfo.createdByName` (a real person's name) and
`createdByUsername` (**their phone number**), and seller-written `description` text routinely
embeds a contact number too.

None of it is needed to compare prices, so:

- the parser never returns any of it,
- `marketplace_listings` has **no column to put it in**, and
- `collectors/hamrobazaar/parser.test.ts` asserts that no seller name, phone number or description
  appears in parser output.

Please keep it that way.

## What was added

| File | Purpose |
| --- | --- |
| `supabase/migrations/20260914_add_marketplace_listings.sql` | The new table (also folded into `supabase/schema.sql`) |
| `collectors/hamrobazaar/parser.ts` | Flight-payload extraction, condition mapping, PII stripping |
| `collectors/hamrobazaar/collector.ts` | One-fetch collector + electronics category filter + CLI |
| `collectors/core/marketplace.ts` | `runMarketplaceCollection` — the listings import path |
| `collectors/marketplaceRegistry.ts` | Registry kept separate from `COLLECTORS` on purpose |
| `lib/marketplace.ts` | Read layer, kept out of `lib/data.ts` |
| `app/marketplace/page.tsx` | Browsable listings page with category filters |
| `components/MarketplaceListingCard.tsx` | Listing card |

Changed: `collectors/core/types.ts` (new `MarketplaceCollector`/`MarketplaceListing` types),
`worker/processor.ts` (routes marketplace ids to the listings path), `worker/scheduler.ts`,
`worker/trigger.ts`, `lib/admin/collections.ts` and `app/admin/collections/page.tsx` (label the row
and its non-applicable columns), `types/database.ts`.

## Where listings are surfaced

Two places:

- **Product pages** — a linked listing appears as a row in the offers table, ranked on price like
  any other, with the seller disclosure attached to that row. See "How listings reach the price
  comparison".
- **`/marketplace`** (`app/marketplace/page.tsx`, reading through `lib/marketplace.ts`) — a
  browsable grid of everything collected, linked or not, with category filter chips.

`lib/marketplace.ts` is kept out of `lib/data.ts` on purpose: everything there feeds the retail
model (products, offers, lowest price, savings, history), and nothing in the marketplace read path
touches `offers` or `price_history`.

Individual listings are **not** added to `sitemap.ts` — they are third-party URLs that expire
within days. Only the index page is.

## How listings reach the price comparison

Linked listings **do** take part in price comparison, and a listing can hold the best-price slot.
A live example at time of writing: `iPhone 17 256 GB` has three shop offers (165,499 / 173,499 /
173,499) and one HamroBazaar listing at 149,999, so the listing is the page's headline price.

A listing is modelled as an `Offer` carrying a `marketplace` marker (`types/index.ts`) rather than
as a parallel concept. That is what lets it rank against real offers in `enrich`, `sortProducts`,
`OfferTable` and search **without any of them growing a special case**. The marker is what the UI
keys off to attach the seller disclosure, and what the alert path keys off to exclude it.

Three things a listing still never does:

1. **Write an offer.** `offers` is `unique(product_id, store_id)`, so many sellers of one model
   could not coexist there. Listings stay in `marketplace_listings` and are joined in at read time
   through `product_id`.
2. **Write price history.** `PriceHistory` renders `price_history`, which no marketplace code path
   writes — so a listing appearing or expiring cannot spike the chart.
3. **Trigger a price alert.** `lib/alerts/evaluate.ts` reads the `offers` table only. Because of
   that, `app/product/[slug]/page.tsx` deliberately seeds `PriceAlertForm` from the lowest
   **shop** price, not `lowestPrice` — otherwise, whenever a listing held the lowest slot, the form
   would propose a target that by definition can never fire.

The disclosure is rendered on **every** marketplace row rather than once per table, because these
rows sit inline among shop offers and can hold the best-price slot: the caveat has to travel with
the individual price rather than be a footnote a reader may not connect to it. A marketplace row
also links straight to the listing instead of through `/go/[offerId]`, since there is no `offers`
row for that redirect to resolve.

## The store filter

A marketplace source is not a row in `stores` and must not become one — the migration explains why,
and everything that enumerates `stores` treats its members as retail price-comparison sources with
`offers` behind them.

But once listings started ranking in the comparison, leaving the source out of the **store filter**
became a visible inconsistency: a shopper could see "HamroBazaar" holding the best price on a
product page and have no way to filter by it. So `getStores`, `getStoreCounts` and `searchProducts`
are marketplace-aware, while the table stays untouched:

- `getStores()` appends one synthetic `Store` per source that has at least one *linked* listing.
  Unlinked listings are excluded on purpose — they have no product, so that filter could only ever
  return an empty page.
- `getStoreCounts()` counts those over `marketplace_listings`, by **distinct product**: two listings
  of the same model from one source are one search result, so counting rows would overstate it.
- `searchProducts()` routes a marketplace slug to `marketplace_listings` instead of the usual
  `offers -> stores` lookup, which for a source with no offers rows would always return nothing.

The `marketplace-` slug prefix (`MARKETPLACE_STORE_PREFIX`) is what those paths route on, so it is
load-bearing rather than decorative.

## Linking: why it needs brand inference

`marketplace_listings.product_id` is set by `collectors/core/marketplaceLink.ts`, a pass that runs
after the upsert and only ever fills a null `product_id` — it never creates a product, writes an
offer, or moves an already-linked row.

It uses the same >=75 confidence bar as the retail path, and that number is only meaningful because
the parser infers a brand from the title first. Measured on the real catalogue **before** brand
inference existed, every one of the 12 listings scored at most 25%, all spurious:

| Listing | Best match | Confidence |
| --- | --- | --- |
| SanDisk Ultra Fit USB **128GB** | iPhone 16 **128 GB** | 25% |
| 1 TB USB SEAGATE HDD | iPhone 17 Pro **1 TB** | 25% |
| Iphone 17 256gb | iPhone **16** 256 GB | 25% |

`brandName` is empty on every listing this site serves, so the matcher's brand signal (+20) never
fired: a *correct* match topped out at model (+40) + storage (+25) = 65, under the bar, while a
bare storage coincidence still scored 25. Linking was therefore either impossible or wrong.

With `inferBrandFromTitle` (explicit token -> brand rules in `collectors/hamrobazaar/parser.ts`),
the same run links `Iphone 17 256gb` -> `iPhone 17 256 GB` at **85%**, while still correctly
rejecting SanDisk -> iPhone (25%) and MacBook -> iPhone 17 Pro (45% — brand agrees, model does not).

A title matching no rule keeps `brand` undefined rather than taking a guess: a wrong brand is worse
than none, because it manufactures the +20 that pushes a wrong candidate over the threshold. That
is why `S26 ultra 256gb` stays unbranded — neither "samsung" nor "galaxy" appears in it, and
"S26 ultra" alone is not a reliable signal.

Only 1 of 12 listings links today. That is the correct number, not a shortfall: the catalogue
currently holds no MacBook Pro M5, S26 Ultra or SanDisk drive to link to. Coverage grows with the
catalogue.

## Why two registries

`MARKETPLACE_COLLECTORS` is deliberately not extra entries in `COLLECTORS`. Everything iterating
`STORE_IDS` treats its members as retail price-comparison sources, and `getCollector` feeds
`runStoreCollection`, which writes offers and price history. Keeping the registries **and the two
collector interfaces** distinct makes wiring a marketplace into the retail path a type error rather
than a convention someone can forget. `collectors/marketplaceRegistry.test.ts` asserts the two
never overlap.

## Running it

```bash
npm run collect:hamrobazaar -- --dry-run   # fetch + parse, print listings, write nothing
npm run collect:hamrobazaar                # write to marketplace_listings
npm run queue:hamrobazaar                  # enqueue through the worker (needs npm run worker:dev)
```

It is also scheduled automatically alongside the retail stores at `COLLECTION_INTERVAL_HOURS`.
`MARKETPLACE_LISTING_LIMIT` (default 100) caps how many listings one run may store.

## Not done

- **Used and "like new" listings are not collected.** The parser can return them
  (`parseHamrobazaarListings(html, { conditions: [...] })`); the collector simply does not ask for
  them. Widening later is a one-line change to `HAMROBAZAAR_WANTED_CONDITIONS`.
- **Unlinked listings appear only on `/marketplace`.** A listing with no confident catalogue match
  is still browsable there; it just has no product page to appear on.
- **Linking is one-way and automatic.** There is no admin UI to review, correct or unlink a match.
  Worth adding if the link rate grows enough for a mistake to matter.
