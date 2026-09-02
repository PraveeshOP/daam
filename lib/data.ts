import { createClient } from "@supabase/supabase-js";
import { categories, products, stores } from "@/lib/seed-data";
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
  })),
  offerStores: (row.offers || [])
    .map((offer) => offer.stores)
    .filter((store): store is DatabaseStore => Boolean(store))
    .map(asStore),
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
const productListSelect =
  "*, categories!inner(name, slug), offers(*, stores(id, name, slug, logo_url, description, affiliate_enabled, partnership_status))";
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
  return (data as unknown as DatabaseStore[]).map(asStore);
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
  return counts;
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
export async function getComparableProducts(limit = 8): Promise<ProductWithOffers[]> {
  if (!supabase) return products.map(enrich).filter((product) => product.stores >= 2).slice(0, limit);

  const offerRows = await fetchAllRows<{ product_id: string }>((from, to) => supabase!.from("offers").select("product_id").eq("is_disabled", false).range(from, to));
  if (!offerRows.length) return [];
  const offerCounts = new Map<string, number>();
  for (const row of offerRows) offerCounts.set(row.product_id, (offerCounts.get(row.product_id) || 0) + 1);
  // A generous buffer over `limit`, not an exact slice — some qualifying ids may turn out
  // inactive on the follow-up fetch, so this leaves room for that filter to still hit `limit`.
  const qualifyingIds = [...offerCounts.entries()].filter(([, count]) => count >= 2).map(([id]) => id).slice(0, Math.max(limit * 3, 50));
  if (!qualifyingIds.length) return [];

  const { data, error } = await supabase.from("products").select(productListSelect).eq("status", "active").in("id", qualifyingIds);
  if (error || !data?.length) return [];
  return (data as unknown as DatabaseProduct[])
    .map(mapDatabaseProduct)
    .map(enrich)
    .filter((product) => product.stores >= 2)
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
    const offerRows = await fetchAllRows<{ product_id: string }>((from, to) =>
      supabase!.from("offers").select("product_id, stores!inner(slug)").eq("stores.slug", filters.store!).eq("is_disabled", false).range(from, to),
    );
    const productIds = [...new Set(offerRows.map((row) => row.product_id))];
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
