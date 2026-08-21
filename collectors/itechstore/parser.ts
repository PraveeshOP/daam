import type { Availability, StoreProduct } from "@/collectors/evo/types";

export type ItechstoreVariant = { id: number; title: string; slug: string; status?: number; color?: number | null };
export type ItechstoreCategoryProduct = { id: number; title: string; slug: string; brand?: { slug?: string; name?: string }; variant_count?: number };
export type ItechstoreCategory = { slug: string; name: string; products: ItechstoreCategoryProduct[] };
export type ItechstoreProductDetail = {
  id: number;
  is_purchasable?: boolean;
  brand?: { slug?: string; name?: string };
  title: string;
  thumbnail?: { src?: string };
  sku?: string;
  price?: number;
  offer_price?: number;
  colors?: { id: number; name: string }[];
  variants?: ItechstoreVariant[];
  selected_variant?: ItechstoreVariant;
};

/** iTechStore's own category taxonomy (`/api/v2/shop/category/<slug>/`) is the authoritative
 * membership signal — unlike every HTML/sitemap-based collector in this codebase there's no
 * regex pre-filter to get wrong here, so `category.products[]` can be iterated directly. */
export function extractCategorySlugs(category: ItechstoreCategory, limit: number): string[] {
  return category.products.map((product) => product.slug).slice(0, limit);
}

const toImageUrl = (src?: string) => (src ? `https://media.itechstore.com.np/f_webp/img/${src}` : undefined);

/**
 * `variants[]` enumerates every color × storage combination (iPhone 16 Pro has 16: 4 storage
 * tiers × up to 4 colors each) — verified live that same-storage variants of different colors
 * share the same price. Neither Evo's nor ITTI's phone collectors explode by color (this
 * codebase's established convention is one row per distinct storage config, not per color), so
 * this keeps only the first variant seen for each distinct `title` (the storage-tier label,
 * e.g. "128GB") rather than fetching and storing every color as its own near-duplicate row.
 */
export function dedupeVariantsByTitle(variants: ItechstoreVariant[]): ItechstoreVariant[] {
  const seen = new Set<string>();
  const rows: ItechstoreVariant[] = [];
  for (const variant of variants) {
    const key = variant.title || variant.slug;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(variant);
  }
  return rows;
}

/**
 * The JSON-LD `availability` on this site's HTML pages was verified live to always read
 * "InStock", even for a confirmed unpurchasable product — so this reads the API's own
 * `is_purchasable` boolean instead, never the page's structured data.
 */
const toAvailability = (isPurchasable?: boolean): Availability => (isPurchasable === undefined ? "unknown" : isPurchasable ? "in_stock" : "out_of_stock");

/**
 * `sku` and `price`/`offer_price` on the base detail response only ever describe the FIRST
 * variant (confirmed live: fetching the same slug with `?variant_slug=<other-variant>` returns a
 * different sku/price under the same top-level `id`) — so a product with multiple variants needs
 * one detail fetch per variant, never just the base fetch, to get real per-variant data. A
 * single-variant ("Default") product needs only the one, already-fetched response.
 */
export function parseItechstoreVariantDetail(detail: ItechstoreProductDetail, productUrl: string): StoreProduct | null {
  const price = detail.offer_price && detail.offer_price > 0 ? detail.offer_price : detail.price;
  if (!price || price <= 0) return null;
  const variantTitle = detail.selected_variant?.title;
  const color = detail.colors?.find((entry) => entry.id === detail.selected_variant?.color)?.name;
  const name = variantTitle && variantTitle !== "Default" ? `${detail.title} ${variantTitle}` : detail.title;

  return {
    externalId: detail.selected_variant ? `${detail.id}-${detail.selected_variant.id}` : String(detail.id),
    name,
    brand: detail.brand?.name,
    color,
    storage: variantTitle && /gb|tb/i.test(variantTitle) ? variantTitle : undefined,
    price,
    currency: "NPR",
    imageUrl: toImageUrl(detail.thumbnail?.src),
    productUrl,
    availability: toAvailability(detail.is_purchasable),
  };
}
