import type { Availability, StoreProduct } from "@/collectors/evo/types";

export type DealayoProduct = {
  id: number;
  sku?: string;
  name: string;
  url_key: string;
  stock_status?: "IN_STOCK" | "OUT_OF_STOCK";
  price_range?: { minimum_price?: { final_price?: { value?: number; currency?: string } } };
  image?: { url?: string };
};
export type DealayoProductsResponse = { data?: { products?: { total_count: number; items: DealayoProduct[] } } };

/**
 * DealAyo's brand data lives only in an HTML spec-table row (`<th>Brand</th><td>Samsung</td>`),
 * not on any GraphQL field (`ProductInterface.manufacturer` returned null on the sampled SKU even
 * though the HTML page shows a real brand; `brand` isn't a queryable field at all) — verified
 * live. Fetching each product's HTML page just for brand would roughly double the request count
 * for the whole bulk-friendly GraphQL approach, so this guesses brand from the product name's own
 * prefix instead, matching the convention Nepal phone listings actually follow in practice
 * (verified across the real sample: "Vivo V60 5G...", "Realme 14...", "Samsung Galaxy A17...").
 */
const KNOWN_PHONE_BRAND_PREFIX = /^(samsung|xiaomi|redmi|poco|oneplus|realme|oppo|vivo|apple|iphone|nothing|honor|infinix|tecno|itel|huawei|nokia|motorola|google|pixel)/i;
function guessBrand(name: string): string | undefined {
  const match = name.match(KNOWN_PHONE_BRAND_PREFIX);
  return match ? match[0].toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined;
}

/**
 * Extracts RAM/storage from names like "12GB RAM 512GB Storage" / "8GB RAM 256GB ROM" as their
 * own StoreProduct fields, rather than leaving the matcher's generic fallback regex to guess —
 * verified live that the fallback alone mislabeled the RAM figure as "storage" (it grabs the
 * FIRST GB number in the name, which is RAM here), silently merging two real, distinctly-priced
 * variants that share the same RAM but differ only in storage (Vivo V60 5G 12GB/512GB vs
 * 12GB/256GB — see the fix and regression test in collectors/core/matcher.ts/test.ts). Setting
 * these explicitly, the same convention every other phone/laptop collector in this codebase
 * follows, means this collector no longer depends on that fallback being correct at all.
 */
function extractRamStorage(name: string): { ram?: string; storage?: string } {
  const ram = name.match(/(\d+(?:\.\d+)?\s*(?:gb|tb))\s*ram/i)?.[1];
  const storage = name.match(/(\d+(?:\.\d+)?\s*(?:gb|tb))\s*(?:storage|rom)\b/i)?.[1];
  return { ram: ram?.replace(/\s+/g, "").toUpperCase(), storage: storage?.replace(/\s+/g, "").toUpperCase() };
}

/**
 * Never key on `sku` — verified live it's slug-derived free text with inconsistent formatting
 * across products (some dash-separated like "samsung-galaxy-a17-8-128", some space-separated like
 * "realme 14t 8-256"), the same class of unreliability this codebase has hit on every other store.
 * The numeric Magento `id` is the one field cross-verified three independent ways on a real
 * product page (price-box `data-product-id`, a hidden form input, and the GraphQL `id` itself all
 * agreeing) — use that instead.
 */
export function parseDealayoProduct(product: DealayoProduct): StoreProduct | null {
  const price = product.price_range?.minimum_price?.final_price?.value;
  if (!price || price <= 0) return null;
  const availability: Availability = product.stock_status === "IN_STOCK" ? "in_stock" : product.stock_status === "OUT_OF_STOCK" ? "out_of_stock" : "unknown";
  const { ram, storage } = extractRamStorage(product.name);

  return {
    externalId: String(product.id),
    name: product.name.trim(),
    brand: guessBrand(product.name),
    ram,
    storage,
    price,
    currency: "NPR",
    imageUrl: product.image?.url,
    productUrl: `https://dealayo.com/${product.url_key}.html`,
    availability,
  };
}

export function parseDealayoProducts(response: DealayoProductsResponse, limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of response.data?.products?.items || []) {
    const row = parseDealayoProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via the `categoryList` GraphQL query: category id 4 ("Mobiles & Tablets") mixes
 * 717 real phones with 1300 accessories (cases/chargers/cables) and other sub-verticals — id 14
 * is the pure-phones subcategory (717 products, matches the parent's phone count exactly), so
 * this targets id 14 directly rather than the noisy parent.
 */
export const DEALAYO_MOBILES_CATEGORY_ID = "14";
