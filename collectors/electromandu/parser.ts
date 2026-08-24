import type { StoreProduct } from "@/collectors/evo/types";

export type ElectromanduProduct = {
  id: number;
  name: string;
  permalink: string;
  sku?: string;
  prices: { price: string; sale_price?: string; currency_minor_unit: number };
  images?: { src?: string }[];
  brands?: { name: string }[];
  is_in_stock?: boolean;
};

/** Same general numeric-entity decoder as collectors/lds/parser.ts and
 * collectors/yantranepal/parser.ts — verified live that this site's category/product names
 * contain literal numeric entities (e.g. a category named "whirlpool 800&#215;800", product
 * names with "&#038;" for "&"). */
const decodeHtml = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();

/** No `brands` taxonomy at all on this site (verified live: `brands: []` on every product
 * sampled) — brand is derived from a known-manufacturer prefix in the name instead, matching the
 * real brands this store's refrigerator catalog actually carries. */
const KNOWN_APPLIANCE_BRAND_PREFIX = /^(lg|samsung|hitachi|whirlpool|ifb|haier|panasonic|sharp|walton|baltra|videocon|godrej|electrolux|bosch|toshiba|singer|midea|tcl|vestar)/i;
function guessBrand(name: string): string | undefined {
  const match = name.match(KNOWN_APPLIANCE_BRAND_PREFIX);
  return match ? match[0].toUpperCase() : undefined;
}

/** `sku` is blank on every product on this site (verified live, no exceptions across 10 sampled
 * products in two categories) — WooCommerce's own JSON-LD falls back to the numeric id when sku
 * is empty, which is exactly what this collector does directly. */
function toPrice(product: ElectromanduProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

export function parseElectromanduProduct(product: ElectromanduProduct): StoreProduct | null {
  const price = toPrice(product);
  if (!price) return null;
  return {
    externalId: String(product.id),
    name: decodeHtml(product.name),
    brand: guessBrand(product.name),
    price,
    currency: "NPR",
    imageUrl: product.images?.[0]?.src,
    productUrl: product.permalink,
    availability: product.is_in_stock === undefined ? "unknown" : product.is_in_stock ? "in_stock" : "out_of_stock",
  };
}

export function parseElectromanduProducts(products: ElectromanduProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseElectromanduProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via /wp-json/wc/store/v1/products/categories: "Refrigerators" (id 68, count 239)
 * is a clean umbrella whose children sum exactly to its own count (Double Door 90 + Single Door
 * 105 + Deep Fridge 19 + 3 Door 9 + Multi Door 12 + Chiller 3 + Side by side 1 = 239) — unlike
 * this site's "Home Appliances" (id 85), whose children sum to 271 against a parent count of 287,
 * a mismatch of the kind other Nepal WooCommerce sites this session have shown (e.g. Yantra
 * Nepal's Laptops). Refrigerators has no such risk.
 */
export const ELECTROMANDU_REFRIGERATOR_CATEGORY_ID = 68;
