import type { StoreProduct } from "@/collectors/evo/types";

type SmartdokoProduct = {
  id: number;
  name: string;
  slug: string;
  thumbnail?: string;
  image?: { full?: string; thumb?: string };
  in_stock?: number;
  sku?: string | number;
  price?: number;
  sale_price?: number;
  category?: { id: number; name: string };
  brand?: { id: number; name: string };
  shareLink?: string;
};
export type SmartdokoFilteredResponse = {
  data: SmartdokoProduct[];
  meta: { current_page: number; last_page: number; total: number };
};

const decodeHtml = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();

/**
 * `sku` on this site is not a real per-product identifier — verified live: all 6 color/storage
 * variants of one "Pre Booking" listing share the identical sku `788884`, and unrelated products
 * across categories reuse placeholder skus like `"1234"`/`"11111"` (confirmed on 3+ distinct real
 * TVs in this exact TVs category). The numeric `id` field is the one confirmed stable, unique
 * identifier, consistent with this codebase's established rule of never trusting a free-text SKU.
 */
function toPrice(product: SmartdokoProduct): number | null {
  const price = product.sale_price && product.sale_price > 0 ? product.sale_price : product.price;
  return typeof price === "number" && price > 0 ? price : null;
}

/**
 * SmartDoko's catalog includes "Pre Booking ..." placeholder listings ahead of real stock
 * arriving (verified live in the smart-phones category: ~12 of 29 listings) — these have no real
 * price signal of their own and would pollute the catalog, so they're dropped rather than
 * imported as real offers.
 */
const PRE_BOOKING_PLACEHOLDER = /^pre[\s-]?booking\b/i;

export function parseSmartdokoProduct(product: SmartdokoProduct, allowedCategoryIds: Set<number>): StoreProduct | null {
  if (product.category && !allowedCategoryIds.has(product.category.id)) return null;
  if (PRE_BOOKING_PLACEHOLDER.test(product.name)) return null;
  const price = toPrice(product);
  if (!price) return null;

  return {
    externalId: String(product.id),
    name: decodeHtml(product.name),
    brand: product.brand?.name,
    price,
    currency: "NPR",
    imageUrl: product.image?.full || product.thumbnail,
    productUrl: product.shareLink || `https://smartdoko.com/product/${product.slug}`,
    availability: product.in_stock === undefined ? "unknown" : product.in_stock > 0 ? "in_stock" : "out_of_stock",
  };
}

export function parseSmartdokoProducts(response: SmartdokoFilteredResponse, allowedCategoryIds: Set<number>, limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of response.data) {
    const row = parseSmartdokoProduct(product, allowedCategoryIds);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via https://smartdoko.com/api/categories: "TVs" (id 2141, slug "tvs") is the
 * umbrella parent for "4K TV" (43), "Smart TV" (1883), and "HD TV" (1886) — filtering the API by
 * the parent slug already returns the union of all three (109 total ≈ 37+58+7+ a few
 * uncategorized), so this collector fetches `category=tvs` directly rather than querying each
 * child separately. A 4th child, "Accessories" (id 1080, wall mounts/stands — verified live, not
 * real TVs), is also nested under the same parent and gets excluded via this allow-list.
 */
export const SMARTDOKO_TV_CATEGORY_SLUG = "tvs";
export const SMARTDOKO_TV_CATEGORY_IDS = new Set([2141, 43, 1883, 1886]);
