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
};

type DatabaseOffer = {
  id: string;
  product_id: string;
  store_id: string;
  price: number | string;
  previous_price: number | string | null;
  availability: string;
  product_url: string;
  last_checked: string;
  stores: DatabaseStore | null;
};

type DatabaseHistory = {
  price: number | string;
  recorded_at: string;
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
  price_history: DatabaseHistory[] | null;
};

const asAvailability = (value: string): Availability =>
  value === "out_of_stock" ? "out_of_stock" : "in_stock";

const asStore = (store: DatabaseStore): Store => ({
  id: store.id,
  name: store.name,
  slug: store.slug,
  logo: store.logo_url?.slice(0, 1).toUpperCase() || store.name.slice(0, 1),
  delivery: store.description || "Delivery across Nepal",
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
  offers: (row.offers || []).map<Offer>((offer) => ({
    id: offer.id,
    productId: offer.product_id,
    storeId: offer.store_id,
    price: Number(offer.price),
    previousPrice:
      offer.previous_price === null ? undefined : Number(offer.previous_price),
    availability: asAvailability(offer.availability),
    productUrl: offer.product_url,
    lastChecked: new Date(offer.last_checked).toLocaleDateString("en-NP", {
      month: "short",
      day: "numeric",
    }),
  })),
  offerStores: (row.offers || [])
    .map((offer) => offer.stores)
    .filter((store): store is DatabaseStore => Boolean(store))
    .map(asStore),
  history: (row.price_history || [])
    .sort(
      (first, second) =>
        new Date(first.recorded_at).getTime() -
        new Date(second.recorded_at).getTime(),
    )
    .map((point) => ({
      label: new Date(point.recorded_at).toLocaleDateString("en-NP", {
        month: "short",
        year: "2-digit",
      }),
      price: Number(point.price),
    })),
  rating: 0,
  reviewCount: 0,
  featured: row.featured,
  createdAt: row.created_at,
});

const productSelect =
  "*, categories!inner(name, slug), offers(*, stores(id, name, slug, logo_url, description)), price_history(price, recorded_at)";

export async function getFeaturedProducts() {
  if (!supabase) return products.filter((product) => product.featured).map(enrich);
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("featured", true)
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
  let request = supabase.from("products").select(productSelect);
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

export async function getProduct(slug: string) {
  if (!supabase) {
    const product = products.find((item) => item.slug === slug);
    return product ? enrich(product) : null;
  }
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return enrich(mapDatabaseProduct(data as unknown as DatabaseProduct));
}

export { categories, stores };
