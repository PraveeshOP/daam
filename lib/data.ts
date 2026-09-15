import { createClient } from "@supabase/supabase-js";
import { categories, products, stores } from "@/lib/seed-data";
import { marketplaceSourceName } from "@/lib/marketplace";
import type { Database } from "@/types/database";
import type {
  Availability,
  Offer,
  Product,
  ProductWithOffers,
  Store,
} from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = supabaseUrl && supabaseKey
  ? createClient<Database>(supabaseUrl, supabaseKey)
  : null;

const enrich = (product: Product): ProductWithOffers => {
  const availablePrices = product.offers
    .filter((offer) => offer.availability === "in_stock")
    .map((offer) => offer.price);
  const prices = availablePrices.length
    ? availablePrices
    : product.offers.map((offer) => offer.price);
  return {
    ...product,
    stores: product.offers.length,
    lowestPrice: prices.length ? Math.min(...prices) : 0,
    highestPrice: prices.length ? Math.max(...prices) : 0,
    savings: prices.length ? Math.max(...prices) - Math.min(...prices) : 0,
  };
};

type DatabaseStore = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  affiliate_enabled?: boolean;
  partnership_status?: string;
};

type DatabaseOffer = {
  id: string;
  product_id: string;
  store_id: string;
  external_id: string | null;
  price: number | string;
  previous_price: number | string | null;
  availability: string;
  is_disabled?: boolean;
  product_url: string;
  affiliate_url?: string | null;
  last_checked: string;
  stores: DatabaseStore | null;
};

type DatabaseMarketplaceListing = {
  id: string;
  source: string;
  external_id: string;
  product_id: string | null;
  title: string;
  price: number | string;
  condition: string;
  negotiable: boolean;
  listing_url: string;
  last_seen_at: string;
};

type DatabaseHistory = {
  price: number | string;
  recorded_at: string;
  store_id?: string | null;
};

export type DatabaseProduct = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  description: string | null;
  image_url: string | null;
  specifications: Record<string, string> | null;
  featured: boolean;
  created_at: string;
  categories: { name: string; slug: string } | null;
  offers: DatabaseOffer[] | null;
  /** Linked C2C listings, embedded through marketplace_listings.product_id. Absent on the
   * seed-data fallback path and on any select that doesn't ask for them. */
  marketplace_listings?: DatabaseMarketplaceListing[] | null;
  // §9-critical (phase-9 audit): list views (getFeaturedProducts/searchProducts) never select
  // price_history at all — ProductCard, the only thing that renders those results, doesn't use
  // it — so this is optional/absent there, and only present (bounded to ~6 months) on getProduct.
  price_history?: DatabaseHistory[] | null;
};

const asAvailability = (value: string): Availability =>
  value === "out_of_stock" ? "out_of_stock" : "in_stock";

const asStore = (store: DatabaseStore): Store => ({
  id: store.id,
  name: store.name,
  slug: store.slug,
  logo: store.logo_url?.slice(0, 1).toUpperCase() || store.name.slice(0, 1),
  delivery: store.description || "Delivery across Nepal",
  affiliateEnabled: store.affiliate_enabled ?? false,
  partnershipStatus: store.partnership_status ?? "none",
});

/**
 * A marketplace source is not a row in `stores` (see the migration for why), but the offers table
 * renders per-store, so one synthetic Store stands in for the whole source. `affiliateEnabled` is
 * false and `partnershipStatus` "none" so the affiliate/destination machinery treats these as
 * plain outbound links, which is exactly what they are.
 */
export const MARKETPLACE_STORE_PREFIX = "marketplace-";

/** True for a slug produced by `marketplaceStore` below. The store filter is a single list mixing
 * real shops and marketplace sources, so the query paths need to tell them apart: the two are
 * backed by different tables. */
export const isMarketplaceStoreSlug = (slug: string) => slug.startsWith(MARKETPLACE_STORE_PREFIX);

export const marketplaceStore = (source: string): Store => ({
  id: `marketplace:${source}`,
  name: marketplaceSourceName(source),
  slug: `${MARKETPLACE_STORE_PREFIX}${source}`,
  logo: marketplaceSourceName(source).slice(0, 1),
  delivery: "Seller advert \u2014 arrange directly",
  affiliateEnabled: false,
  partnershipStatus: "none",
});

/**
 * A listing becomes an `Offer` so it ranks alongside real offers without every consumer (enrich,
 * sortProducts, OfferTable, search) needing a parallel code path. `availability` is "in_stock"
 * because a listing only exists while the seller still has the item — there is no out-of-stock
 * state to represent, and marking them otherwise would drop them out of `enrich`'s in-stock price
 * set and silently exclude them from the comparison.
 */
const asMarketplaceOffer = (listing: DatabaseMarketplaceListing): Offer => ({
  id: `marketplace:${listing.id}`,
  productId: listing.product_id || "",
  storeId: `marketplace:${listing.source}`,
  externalId: listing.external_id,
  price: Number(listing.price),
  availability: "in_stock",
  productUrl: listing.listing_url,
  lastChecked: new Date(listing.last_seen_at).toLocaleDateString("en-NP", { month: "short", day: "numeric" }),
  lastCheckedAt: listing.last_seen_at,
  marketplace: {
    source: listing.source,
    sourceName: marketplaceSourceName(listing.source),
    condition: listing.condition,
    negotiable: listing.negotiable,
  },
});

export const mapDatabaseProduct = (row: DatabaseProduct): Product => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  brand: row.brand,
  category: row.categories?.name || "Uncategorized",
  categorySlug: row.categories?.slug || "uncategorized",
  description: row.description || "Compare offers from trusted stores in Nepal.",
  image: row.image_url || "/product-placeholder.svg",
  specs: Object.entries(row.specifications || {}).map(([label, value]) => ({
    label,
    value,
  })),
  offers: (row.offers || []).filter((offer) => !offer.is_disabled).map<Offer>((offer) => ({
    id: offer.id,
    productId: offer.product_id,
    storeId: offer.store_id,
    externalId: offer.external_id || undefined,
    price: Number(offer.price),
    previousPrice:
      offer.previous_price === null ? undefined : Number(offer.previous_price),
    availability: asAvailability(offer.availability),
    productUrl: offer.product_url,
    affiliateUrl: offer.affiliate_url || undefined,
    lastChecked: new Date(offer.last_checked).toLocaleDateString("en-NP", {
      month: "short",
      day: "numeric",
    }),
    lastCheckedAt: offer.last_checked,
  })).concat((row.marketplace_listings || []).map(asMarketplaceOffer)),
  offerStores: (row.offers || [])
    .map((offer) => offer.stores)
    .filter((store): store is DatabaseStore => Boolean(store))
    .map(asStore)
    .concat([...new Set((row.marketplace_listings || []).map((listing) => listing.source))].map(marketplaceStore)),
  history: Object.values((row.price_history || [])
    .sort(
      (first, second) =>
        new Date(first.recorded_at).getTime() -
        new Date(second.recorded_at).getTime(),
    )
    .reduce<Record<string, { label: string; price: number; timestamp: number }>>((history, point) => {
      const timestamp = new Date(point.recorded_at).getTime();
      const label = new Date(point.recorded_at).toLocaleDateString("en-NP", {
        month: "short",
        year: "2-digit",
      });
      const price = Number(point.price);
      history[label] = history[label] ? { label, timestamp: Math.min(history[label].timestamp, timestamp), price: Math.min(history[label].price, price) } : { label, timestamp, price };
      return history;
    }, {}))
    .sort((first, second) => first.timestamp - second.timestamp)
    .map(({ label, price }) => ({ label, price })),
  rating: 0,
  reviewCount: 0,
  featured: row.featured,
  createdAt: row.created_at,
});

// §9-critical (phase-9 audit): the offer/store columns list views actually need, without
// price_history — a homepage/search request used to drag every historical price point ever
// recorded for every matching product, unfiltered by date or count, even though ProductCard (the
// only thing rendering these results) never reads `history`. getProduct has its own select below
// that adds price_history back, bounded to the window the UI actually shows.
const MARKETPLACE_EMBED = "marketplace_listings(id, source, external_id, product_id, title, price, condition, negotiable, listing_url, last_seen_at)";
const productListSelect =
  `*, categories!inner(name, slug), offers(*, stores(id, name, slug, logo_url, description, affiliate_enabled, partnership_status)), ${MARKETPLACE_EMBED}`;
const PRICE_HISTORY_MONTHS = 6;

/**
 * §1000-row-cap (live bug report, phase-10 audit): PostgREST silently caps any query with no
 * explicit .range()/.limit() at 1000 rows — this was never wrong while `products`/`offers` stayed
 * under that, but a full-catalog import crossing 1000 offers turned every plain, unranged
 * aggregate query below into a silent undercount (e.g. "Popular comparisons" reading 3 qualifying
 * products instead of the real 11, because the 2+-offer count was only ever computed over
 * whichever arbitrary first 1000 offer rows PostgREST happened to return). `buildPage` must
 * construct a *fresh* query per call (re-applying every filter) since an already-awaited
 * supabase-js query builder can't be re-executed with a different .range().
 */
async function fetchAllRows<T>(buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1);
    if (error || !data || !data.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * §category-count (live bug report): FilterSidebar used to derive each category's count from
 * the already-category-filtered `products` list passed into it — so viewing Laptops made every
 * *other* category's count collapse to 0 (only laptops are in that array, and 0 of them are
 * Smartphones), which reads as "there are no smartphones" when there are actually 97. This is a
 * separate, lightweight query — deliberately not the full `productListSelect` — so it can count
 * across every category at once, ignoring the category filter, while still respecting an active
 * search-text query (a category count should still narrow when you're searching "iphone").
 *
 * §cross-facet (live bug report): counts also need to respect an active STORE filter — otherwise
 * selecting a single-category store (e.g. Bigbyte, cameras-only) still showed every category's
 * *global* count in the sidebar, so clicking into "Smartphones" landed on 0 results while the
 * sidebar kept reading "Bigbyte 82", with no indication that combination was empty. `storeSlug` is
 * optional and, when given, narrows to products actually carried by that store (via an inner join
 * through offers -> stores) — while still counting across every category, never just the one
 * currently selected, which is the whole point of this being a separate query in the first place.
 */
export async function getCategoryCounts(query = "", storeSlug?: string): Promise<Record<string, number>> {
  if (!supabase) {
    const normalized = query.toLowerCase().trim();
    const storeById = new Map(stores.map((store) => [store.id, store]));
    const counts: Record<string, number> = {};
    for (const product of products) {
      if (normalized && !`${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(normalized)) continue;
      if (storeSlug && !product.offers.some((offer) => storeById.get(offer.storeId)?.slug === storeSlug)) continue;
      counts[product.categorySlug] = (counts[product.categorySlug] || 0) + 1;
    }
    return counts;
  }
  const safeQuery = query.replace(/[%,()]/g, " ").trim();
  // Two separate literal .select() strings, not one built from a ternary — supabase-js parses
  // the select string at the TYPE level to infer the row shape, and a computed/conditional string
  // breaks that parser (it can't statically know which branch runs), producing a ParserError type
  // instead of the real row shape.
  const data = storeSlug
    ? await fetchAllRows<{ categories: { slug: string } | null }>((from, to) => {
        let request = supabase!.from("products").select("categories!inner(slug), offers!inner(stores!inner(slug))").eq("status", "active").eq("offers.stores.slug", storeSlug).eq("offers.is_disabled", false);
        if (safeQuery) request = request.or(`name.ilike.%${safeQuery}%,brand.ilike.%${safeQuery}%`);
        return request.range(from, to);
      })
    : await fetchAllRows<{ categories: { slug: string } | null }>((from, to) => {
        let request = supabase!.from("products").select("categories!inner(slug)").eq("status", "active");
        if (safeQuery) request = request.or(`name.ilike.%${safeQuery}%,brand.ilike.%${safeQuery}%`);
        return request.range(from, to);
      });
  const counts: Record<string, number> = {};
  for (const row of data) {
    const slug = row.categories?.slug;
    if (slug) counts[slug] = (counts[slug] || 0) + 1;
  }
  return counts;
}

/**
 * §store-filter (same live bug report): the Store filter list was the hardcoded seed-data
 * array — it still listed three stores that no longer exist (removed as unused placeholders)
 * and never listed Mobilemandu at all. Real stores, straight from the table that
 * `collectors/registry.ts` actually feeds.
 */
export async function getStores(): Promise<Store[]> {
  if (!supabase) return stores;
  const { data, error } = await supabase.from("stores").select("id, name, slug, logo_url, description, affiliate_enabled, partnership_status").order("name");
  if (error || !data?.length) return stores;
  const shopStores = (data as unknown as DatabaseStore[]).map(asStore);
  // Marketplace sources are not rows in `stores` (see the migration for why) but their listings
  // do rank in the comparison, so leaving them out of this list meant a shopper could see
  // "HamroBazaar" holding the best price on a product page and have no way to filter by it.
  // Appended rather than merged in alphabetically: these are a different kind of thing, and the
  // filter reads better with the real shops first.
  return [...shopStores, ...(await getMarketplaceStores())];
}

/** One synthetic Store per marketplace source that currently has at least one *linked* listing.
 * Unlinked listings are excluded deliberately: they have no product, so filtering search results
 * by that source could never return them, and offering the filter would be a dead end. */
async function getMarketplaceStores(): Promise<Store[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("marketplace_listings").select("source").not("product_id", "is", null).limit(1000);
  if (error || !data?.length) return [];
  return [...new Set((data as { source: string }[]).map((row) => row.source))].sort().map(marketplaceStore);
}

/**
 * Same idea and shape as getCategoryCounts (same §category-count fix, same §cross-facet fix) — a
 * separate, lightweight query rather than deriving each store's count from the current page's
 * already-filtered `products`, so viewing one store's products doesn't zero out every other
 * store's count. Counts live, non-disabled offers only, keyed by store slug (the same key the
 * Store filter buttons use). `categorySlug` is optional and, when given, narrows to products
 * actually in that category — mirroring getCategoryCounts' `storeSlug` param — so a store's count
 * correctly reads 0 once a category with no overlap is also selected, instead of still showing
 * that store's *global* total.
 */
export async function getStoreCounts(query = "", categorySlug?: string): Promise<Record<string, number>> {
  if (!supabase) {
    const normalized = query.toLowerCase().trim();
    const storeById = new Map(stores.map((store) => [store.id, store]));
    const counts: Record<string, number> = {};
    for (const product of products) {
      if (normalized && !`${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(normalized)) continue;
      if (categorySlug && product.categorySlug !== categorySlug) continue;
      for (const offer of product.offers) {
        const store = storeById.get(offer.storeId);
        if (store) counts[store.slug] = (counts[store.slug] || 0) + 1;
      }
    }
    return counts;
  }
  const safeQuery = query.replace(/[%,()]/g, " ").trim();
  // Two separate literal .select() strings — see the matching comment in getCategoryCounts for
  // why a ternary-built select string breaks supabase-js's compile-time row-shape parser.
  const data = categorySlug
    ? await fetchAllRows<{ offers: { is_disabled?: boolean; stores: { slug: string } | null }[] | null }>((from, to) => {
        let request = supabase!.from("products").select("offers(is_disabled, stores(slug)), categories!inner(slug)").eq("status", "active").eq("categories.slug", categorySlug);
        if (safeQuery) request = request.or(`name.ilike.%${safeQuery}%,brand.ilike.%${safeQuery}%`);
        return request.range(from, to);
      })
    : await fetchAllRows<{ offers: { is_disabled?: boolean; stores: { slug: string } | null }[] | null }>((from, to) => {
        let request = supabase!.from("products").select("offers(is_disabled, stores(slug))").eq("status", "active");
        if (safeQuery) request = request.or(`name.ilike.%${safeQuery}%,brand.ilike.%${safeQuery}%`);
        return request.range(from, to);
      });
  const counts: Record<string, number> = {};
  for (const row of data) {
    for (const offer of row.offers || []) {
      if (offer.is_disabled) continue;
      const slug = offer.stores?.slug;
      if (slug) counts[slug] = (counts[slug] || 0) + 1;
    }
  }
  Object.assign(counts, await getMarketplaceStoreCounts(safeQuery, categorySlug));
  return counts;
}

/**
 * The marketplace half of getStoreCounts. Counted over `marketplace_listings` rather than
 * `offers`, and over *distinct products* — two listings of the same model from the same source
 * are one product in the results, so counting rows would overstate what the filter returns.
 */
async function getMarketplaceStoreCounts(query: string, categorySlug?: string): Promise<Record<string, number>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select("source, product_id, products!inner(name, brand, status, categories!inner(slug))")
    .not("product_id", "is", null)
    .eq("products.status", "active")
    .limit(1000);
  if (error || !data) return {};
  type Row = { source: string; product_id: string | null; products: { name: string; brand: string; categories: { slug: string } | null } | null };
  const seen = new Map<string, Set<string>>();
  const normalized = query.toLowerCase().trim();
  for (const row of data as unknown as Row[]) {
    if (!row.product_id || !row.products) continue;
    if (categorySlug && row.products.categories?.slug !== categorySlug) continue;
    if (normalized && !`${row.products.name} ${row.products.brand}`.toLowerCase().includes(normalized)) continue;
    const slug = `${MARKETPLACE_STORE_PREFIX}${row.source}`;
    if (!seen.has(slug)) seen.set(slug, new Set());
    seen.get(slug)!.add(row.product_id);
  }
  return Object.fromEntries([...seen.entries()].map(([slug, ids]) => [slug, ids.size]));
}

/**
 * §multi-store-only (user report): "Popular comparisons" is meant to showcase genuine price
 * *comparisons* — a single-store product has nothing to compare. This is NOT gated on the
 * `featured` flag (a manually-curated admin pick from early on that has no way of tracking new
 * cross-store matches as they appear — the exact "hardcoded" behavior a later user report asked
 * to remove) — it's a real, live query: every product with 2+ non-disabled offers, discovered
 * fresh on every call.
 *
 * Two-step query rather than one: fetching the full `productListSelect` (specifications,
 * description, price history, every offer) for all ~800 active products just to check each one's
 * offer count would be wasteful. The cheap first query only reads `offers.product_id` to find
 * which products actually qualify; the second query fetches full detail for just those ids.
 */
/**
 * Largest price gap between stores, biggest first — the thing the site exists to demonstrate.
 *
 * Previously this returned an arbitrary eight products with 2+ offers: nothing anywhere applied
 * an order, so the set came back in whatever sequence PostgREST happened to return offer rows and
 * could differ between requests, under a heading promising "Trending now / Popular comparisons".
 *
 * Ranking by *views* was considered and rejected on the data: analytics holds 77 events across 16
 * products, all of it development traffic, with zero favourites and zero alerts. Ordering by that
 * would surface whatever someone last clicked, which is neither popular nor useful. Savings needs
 * no traffic to be meaningful and answers the question a shopper actually has — where does using
 * this site pay off?
 *
 * Absolute rupees, not percent: a shopper saving NPR 40,000 on a laptop cares more than one saving
 * 30% on a cable, and big-ticket items are exactly where comparing matters.
 */
const MAX_PLAUSIBLE_PRICE_RATIO = 2.5;

export async function getComparableProducts(limit = 8): Promise<ProductWithOffers[]> {
  if (!supabase) return products.map(enrich).filter((product) => product.stores >= 2).sort((first, second) => second.savings - first.savings).slice(0, limit);

  // `price` is selected alongside `product_id` so the ranking can be computed from this one query
  // instead of fetching full product rows for every candidate just to read their prices.
  const offerRows = await fetchAllRows<{ product_id: string; price: number | string }>((from, to) =>
    supabase!.from("offers").select("product_id, price").eq("is_disabled", false).range(from, to),
  );
  if (!offerRows.length) return [];

  const pricesByProduct = new Map<string, number[]>();
  for (const row of offerRows) {
    const price = Number(row.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const prices = pricesByProduct.get(row.product_id);
    if (prices) prices.push(price);
    else pricesByProduct.set(row.product_id, [price]);
  }

  const ranked = [...pricesByProduct.entries()]
    .filter(([, prices]) => prices.length >= 2)
    .map(([id, prices]) => {
      const lowest = Math.min(...prices);
      const highest = Math.max(...prices);
      return { id, offerCount: prices.length, savings: highest - lowest, ratio: highest / lowest };
    })
    // A spread this wide between shops selling the same thing is far more likely a bad product
    // match or a mispriced offer than a real bargain, and the homepage is the worst place to
    // advertise a saving that does not exist. Verified against live data: the two widest spreads
    // in the catalogue both trace back to offers left behind by an incorrect merge.
    .filter((entry) => entry.ratio <= MAX_PLAUSIBLE_PRICE_RATIO)
    // Deterministic all the way down, so the homepage does not reshuffle between requests.
    .sort((first, second) => second.savings - first.savings || second.offerCount - first.offerCount || first.id.localeCompare(second.id));

  // A buffer over `limit`: some of these will turn out inactive on the fetch below.
  const shortlist = ranked.slice(0, Math.max(limit * 4, 40));
  if (!shortlist.length) return [];
  const order = new Map(shortlist.map((entry, index) => [entry.id, index]));

  const { data, error } = await supabase.from("products").select(productListSelect).eq("status", "active").in("id", [...order.keys()]);
  if (error || !data?.length) return [];
  return (data as unknown as DatabaseProduct[])
    .map(mapDatabaseProduct)
    .map(enrich)
    .filter((product) => product.stores >= 2)
    // `.in()` does not preserve the order it was given, so the ranking is reapplied here.
    .sort((first, second) => (order.get(first.id) ?? Infinity) - (order.get(second.id) ?? Infinity))
    .slice(0, limit);
}

export type SearchFilters = {
  category?: string;
  store?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: "relevance" | "lowest" | "highest" | "discount" | "recent";
};

const sortProducts = (items: ProductWithOffers[], sort = "relevance") =>
  [...items].sort((first, second) => {
    if (sort === "lowest") return first.lowestPrice - second.lowestPrice;
    if (sort === "highest") return second.lowestPrice - first.lowestPrice;
    if (sort === "discount") return second.savings - first.savings;
    if (sort === "recent") {
      return (
        new Date(second.createdAt || 0).getTime() -
        new Date(first.createdAt || 0).getTime()
      );
    }
    return 0;
  });

const hasStore = (product: Product, storeId: string) =>
  product.offers.some(
    (offer) =>
      offer.storeId === storeId ||
      stores.some(
        (store) =>
          store.id === offer.storeId &&
          (store.id === storeId || store.slug === storeId),
      ),
  ) ||
  Boolean(product.offerStores?.some((store) => store.id === storeId || store.slug === storeId));

export async function searchProducts(query = "", filters: SearchFilters = {}) {
  if (!supabase) {
    const normalized = query.toLowerCase().trim();
    const results = products
      .filter(
        (product) =>
          (!normalized ||
            `${product.name} ${product.brand} ${product.category}`
              .toLowerCase()
              .includes(normalized)) &&
          (!filters.category || product.categorySlug === filters.category) &&
          (!filters.store || hasStore(product, filters.store)) &&
          (!filters.inStock ||
            product.offers.some((offer) => offer.availability === "in_stock")) &&
          (filters.minPrice === undefined ||
            product.offers.some(
              (offer) =>
                offer.price >= filters.minPrice! &&
                (filters.maxPrice === undefined || offer.price <= filters.maxPrice!),
            )),
      )
      .map(enrich);
    return sortProducts(results, filters.sort);
  }
  // §9-critical (phase-9 audit): an empty/broad query used to return the entire active catalog
  // with no cap at all — this is a stopgap ceiling, not real pagination (see the searchProducts
  // doc comment above SearchFilters for why proper paginated + faceted search is a follow-up,
  // not a same-patch fix: FilterSidebar's facets and the in-memory price/stock filters below both
  // need the full matching set to stay correct, which real pagination would have to account for
  // deliberately rather than as a quick tweak).
  //
  // §store-filter-cap (live bug report): the store filter used to run AFTER this cap, as an
  // in-memory `hasStore` check over whatever 200 products happened to come back with no store
  // filter applied at all — so a store's sidebar count (a real, uncapped query — getStoreCounts
  // above) could read "20" while the actual filtered results showed only however many of that
  // store's products happened to survive into that arbitrary first-200 window (often far fewer,
  // sometimes 0). Resolved the same way as the category filter just below it: find the matching
  // product ids first (a real, unbounded query over `offers`), then apply the 200-row cap to
  // *that* already-narrowed set — never the other way around.
  const SEARCH_RESULT_CAP = 200;
  let request = supabase.from("products").select(productListSelect).eq("status", "active");
  const safeQuery = query.replace(/[%,()]/g, " ").trim();
  if (safeQuery) request = request.or(`name.ilike.%${safeQuery}%,brand.ilike.%${safeQuery}%`);
  if (filters.category) request = request.eq("categories.slug", filters.category);
  if (filters.store) {
    // A marketplace source has no `offers` rows at all, so the usual offers->stores lookup would
    // always come back empty and the filter would silently return nothing. Its product ids come
    // from the listings table instead.
    const productIds = isMarketplaceStoreSlug(filters.store)
      ? [...new Set((await fetchAllRows<{ product_id: string | null }>((from, to) =>
          supabase!.from("marketplace_listings").select("product_id").eq("source", filters.store!.slice(MARKETPLACE_STORE_PREFIX.length)).not("product_id", "is", null).range(from, to),
        )).map((row) => row.product_id).filter((id): id is string => Boolean(id)))]
      : [...new Set((await fetchAllRows<{ product_id: string }>((from, to) =>
          supabase!.from("offers").select("product_id, stores!inner(slug)").eq("stores.slug", filters.store!).eq("is_disabled", false).range(from, to),
        )).map((row) => row.product_id))];
    if (!productIds.length) return [];
    request = request.in("id", productIds);
  }
  request = request.limit(SEARCH_RESULT_CAP);
  const { data, error } = await request;
  if (error || !data?.length) return [];
  const results = (data as unknown as DatabaseProduct[])
    .map(mapDatabaseProduct)
    .filter(
      (product) =>
        (!filters.store || hasStore(product, filters.store)) &&
        (!filters.inStock ||
          product.offers.some((offer) => offer.availability === "in_stock")) &&
        (filters.minPrice === undefined ||
          product.offers.some(
            (offer) =>
              offer.price >= filters.minPrice! &&
              (filters.maxPrice === undefined || offer.price <= filters.maxPrice!),
          )),
    )
    .map(enrich);
  return sortProducts(results, filters.sort);
}

// The one place price_history is actually rendered (PriceHistory's "Last 6 months" chart) — the
// query is bounded to match what that label claims, instead of fetching every point ever recorded
// (§9-high, phase-9 audit) and relying on client-side code to (or forget to) trim it back down.
const productDetailSelect = `${productListSelect}, price_history(price, recorded_at)`;

export async function getProduct(slug: string) {
  if (!supabase) {
    const product = products.find((item) => item.slug === slug);
    return product ? enrich(product) : null;
  }
  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - PRICE_HISTORY_MONTHS);
  const { data, error } = await supabase
    .from("products")
    .select(productDetailSelect)
    .eq("slug", slug)
    .eq("status", "active")
    .gte("price_history.recorded_at", sinceDate.toISOString())
    .maybeSingle();
  if (error || !data) return null;
  return enrich(mapDatabaseProduct(data as unknown as DatabaseProduct));
}

export { categories, stores };
