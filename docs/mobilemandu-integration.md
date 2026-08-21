# Adding a store: Mobilemandu

A worked example of adding a real third store to the existing collector architecture — reusing
every piece (`StoreCollector` interface, the shared matcher, `importStoreProduct`, BullMQ,
the scheduler, the admin dashboard) with zero changes to any of them.

## Why Mobilemandu

Checked before writing any code:

- `robots.txt` only disallows `/nogooglebot/` — no blanket bot-blocking, and (unlike a couple of
  other candidates checked) it does **not** disallow AI-crawler user agents specifically.
- A working `sitemap.xml` → `sitemaps/products.xml` with ~3,174 product URLs, a few hundred of
  them smartphones.
- Every product page carries a standard schema.org `Product` JSON-LD block — `name`, `sku`,
  `brand`, `category`, and an `offers` object with `price`/`priceCurrency`/`availability` — the
  same shape of signal Evo's collector already relies on.
- Real category overlap with both existing stores (smartphones), so matching against the
  existing catalog could actually be exercised and verified.
- Homepage and product pages returned plain `200 OK` with no CAPTCHA/challenge page — checked
  directly (`curl` with the collector's own User-Agent), not assumed.

One other real candidate (Oliz Store) returned `403 Forbidden` on both its homepage and sitemap
when checked the same way — a clear bot-protection signal — and was excluded per the rule to
never bypass that kind of access control.

## What was added

No changes to `collectors/core/*`, `worker/*`, `lib/admin/*`, `app/admin/*`, analytics, price
alerts, or the matching algorithm. Only:

- `collectors/mobilemandu/{collector.ts,parser.ts,parser.test.ts}` — same shape as
  `collectors/evo`/`collectors/itti`.
- One line in `collectors/registry.ts` registering it — this is the only place a new store is
  wired into the worker, scheduler, admin dashboard, or manual-trigger scripts; none of those
  files know Mobilemandu's name.
- Two `package.json` scripts (`collect:mobilemandu`, `queue:mobilemandu`), matching the existing
  per-store script pattern.
- One assertion in `collectors/registry.test.ts` (the existing "every registered store" test) —
  the only pre-existing test file that needed to change at all.

No database migration was needed — `ensureStore()` (already generic, upserts by slug) creates the
`stores` row the first time the collector runs.

## Parsing notes specific to this store (kept inside `collectors/mobilemandu/parser.ts`)

- Product names carry an SEO subtitle after a `|` (e.g. `"Apple iPhone 16 (128 GB) || Mobile
  Phones"`) — stripped before the name is used anywhere.
- No structured RAM/storage field exists in the JSON-LD (unlike Evo's `additionalProperty` list),
  so it's extracted from either a `"(8/256)"` shorthand or a `"8GB RAM 128GB Storage"`-style
  string in the name/slug — best-effort; the matcher still works on brand+model text alone when
  neither can be confidently extracted.
- Some (not all) product descriptions have invisible zero-width Unicode characters embedded
  mid-word — stripped before storing; never present in the structured fields (price/sku/category)
  the matcher and importer actually depend on.
- The sitemap's brand-keyword URL filter is only a rough pre-filter — it lets through tablets,
  earbuds, and even an unrelated appliance brand that happens to share a name (a "Vivo" clothes
  iron). The JSON-LD `category` field (`"Mobile Phones"` vs. `"Tablets"`/`"Earbuds"`/etc.) is the
  real accuracy check, applied when parsing each page — a wrong-category page is treated as an
  expected skip, the same way Evo's collector treats a missing product JSON-LD.

## Verified live against the real Supabase project

- **Import**: 35 products fetched, 0 errors, 30 confirmed smartphones (5 correctly rejected by
  the category check) — 28 new canonical products, 2 correctly matched into existing ones.
- **Cross-store matching**: "Apple iPhone 15 128GB" matched into the same canonical product ITTI
  already had (2 offers); "iPhone 16 128GB" matched into the same canonical product both Evo and
  ITTI already had (3 offers, one per store) — the exact result the spec's own worked example
  describes. Zero uncertain matches were logged for this batch.
- **Variant safety**: iPhone 16 (regular), iPhone 16 Pro, iPhone 16 Pro Max, and the 128GB/256GB
  storage splits all stayed as distinct canonical products — confirmed directly against the
  database, not just by inspection of the collector's own confidence score.
- **Duplicate-run safety**: running the same import twice produced the same 30 offers and 30
  price_history rows both times — second run reported 0 created, 30 updated, 0 price changes.
- **Price change**: manually walked one real offer through a price drop — `offers.price` and
  `previous_price` updated correctly, exactly one new `price_history` row appended (old row kept),
  restored afterward.
- **Price alerts**: created a temporary user + alert targeting a price below Mobilemandu's actual
  price, then dropped that offer's price below the target through the normal import path — the
  alert claimed itself (`triggered_at` set) and a notification job was enqueued with the correct
  alert id and triggered price, using the existing alert/notification pipeline unmodified.
- **BullMQ / scheduler**: `mobilemandu scheduled every 360m` appeared in the worker's own startup
  log immediately after registering the collector — no scheduler code was touched. A real
  scheduled job ran end-to-end (20 discovered, 20 matched, 0 errors) and completed successfully.
- **Admin visibility**: the store row, offer count (30), and BullMQ job history all resolve
  correctly through the existing `lib/admin/stores.ts`/`lib/admin/collections.ts` functions —
  health derives to "healthy," 100% score, 0 errors, matching the admin dashboard's existing
  health-scoring logic with no changes to it.
- **Search / product page**: search returns each canonical product once regardless of how many
  stores carry it; the iPhone 16 128GB product page correctly lists Evo, ITTI, and Mobilemandu as
  three separate offers on one product.

## Not done (intentionally, per the "start small" instruction)

- Only ~20-50 products (the requested initial batch), not the full catalog.
- Only the Smartphones category — Mobilemandu also sells laptops/appliances, left for a later,
  separate pass once this integration has run unattended for a while.
- No changes to the matcher's confidence thresholds — the existing 75%/55% cutoffs handled this
  store's data correctly as-is; there was no evidence they needed adjusting.
