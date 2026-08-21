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
 * §category-count (live bug report): FilterSidebar used to derive each category's count from
 * the already-category-filtered `products` list passed into it — so viewing Laptops made every
 * *other* category's count collapse to 0 (only laptops are in that array, and 0 of them are
 * Smartphones), which reads as "there are no smartphones" when there are actually 97. This is a
 * separate, lightweight query — deliberately not the full `productListSelect` — so it can count
 * across every category at once, ignoring the category filter, while still respecting an active
 * search-text query (a category count should still narrow when you're searching "iphone").
 */
export async function getCategoryCounts(query = ""): Promise<Record<string, number>> {
  if (!supabase) {
    const normalized = query.toLowerCase().trim();
    const counts: Record<string, number> = {};
    for (const product of products) {
      if (normalized && !`${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(normalized)) continue;
      counts[product.categorySlug] = (counts[product.categorySlug] || 0) + 1;
    }
    return counts;
  }
  let request = supabase.from("products").select("categories!inner(slug)").eq("status", "active");
  const safeQuery = query.replace(/[%,()]/g, " ").trim();
  if (safeQuery) request = request.or(`name.ilike.%${safeQuery}%,brand.ilike.%${safeQuery}%`);
  const { data, error } = await request;
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const row of data as unknown as { categories: { slug: string } | null }[]) {
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

export async function getFeaturedProducts() {
  if (!supabase) return products.filter((product) => product.featured).map(enrich);
  const { data, error } = await supabase
    .from("products")
    .select(productListSelect)
    .eq("featured", true)
    .eq("status", "active")
    .limit(8);
  if (error || !data?.length) {
    return products.filter((product) => product.featured).map(enrich);
  }
  return (data as unknown as DatabaseProduct[]).map(mapDatabaseProduct).map(enrich);
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
  // not a same-patch fix: FilterSidebar's facets and the in-memory store/price/stock filters
  // below both need the full matching set to stay correct, which real pagination would have to
  // account for deliberately rather than as a quick tweak).
  const SEARCH_RESULT_CAP = 200;
  let request = supabase.from("products").select(productListSelect).eq("status", "active").limit(SEARCH_RESULT_CAP);
  const safeQuery = query.replace(/[%,()]/g, " ").trim();
  if (safeQuery) request = request.or(`name.ilike.%${safeQuery}%,brand.ilike.%${safeQuery}%`);
  if (filters.category) request = request.eq("categories.slug", filters.category);
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
