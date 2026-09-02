import type { StoreProduct } from "@/collectors/evo/types";

export type RapidotechProduct = {
  id: number;
  name: string;
  permalink: string;
  sku?: string;
  type?: string;
  prices: { price: string; sale_price?: string; currency_minor_unit: number };
  images?: { src?: string }[];
  brands?: { name: string }[];
  is_in_stock?: boolean;
};

const decodeHtml = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();

/**
 * `sku` is blank on 49/50 sampled products (verified live) — use the numeric `id` instead.
 * `currency_minor_unit` is 0 on this site (like SewasMart, unlike most others this session) — the
 * divisor is still read per-response, never hardcoded. `brands[]` is reliably populated here
 * (Redragon, AULA, AJAZZ, DAREU, ATK, VXE all confirmed real).
 *
 * ~1 in 32 products in this category is a WooCommerce `variable` product (color options etc.) —
 * verified live its base `prices.price` already reflects the lowest real variant price (matching
 * `price_range.min_amount` exactly), so this is used as-is rather than fetching every variation
 * separately, the same "good enough starting price" simplification used elsewhere in this
 * codebase when a site's own list price already resolves sensibly.
 */
function toPrice(product: RapidotechProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

export function parseRapidotechProduct(product: RapidotechProduct): StoreProduct | null {
  const price = toPrice(product);
  if (!price) return null;
  return {
    externalId: String(product.id),
    name: decodeHtml(product.name),
    brand: product.brands?.[0]?.name,
    price,
    currency: "NPR",
    imageUrl: product.images?.[0]?.src,
    productUrl: product.permalink,
    availability: product.is_in_stock === undefined ? "unknown" : product.is_in_stock ? "in_stock" : "out_of_stock",
  };
}

export function parseRapidotechProducts(products: RapidotechProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseRapidotechProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live: this site skews heavily toward PC-peripheral/mobile accessories (cases, cables,
 * chargers) — of its three named accessory umbrellas (Audio, Camera, Mobile Accessories), only
 * "Speakers" (id 935, count 32) is a clean, non-diluted category of genuine consumer devices
 * (Redragon, Anker Soundcore, Tronsmart, Xiaomi). Camera & Accessories has only 5 real products
 * (action cameras) — too thin to build a standalone collector against; Smart Watch has only 2.
 */
export const RAPIDOTECH_SPEAKER_CATEGORY_ID = 935;
