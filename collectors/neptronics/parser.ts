import type { StoreProduct } from "@/collectors/evo/types";

export type NeptronicsProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku?: string;
  prices: { price: string; currency_minor_unit: number };
  images?: { src?: string }[];
  is_in_stock?: boolean;
};

const decodeHtml = (value: string) => value.replace(/&amp;/g, "&").replace(/&#8211;/g, "–").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();

/**
 * The Store API's own `sku` field is empty on every single product on this site (confirmed live
 * across the full 117-item catalog) — this codebase never trusts a free-text SKU blindly anyway,
 * so the product `slug` (also embedded in `permalink`) is the stable external id, consistent with
 * every other collector's fallback-to-URL convention.
 *
 * `prices.price` is a string in minor units scaled by `currency_minor_unit` (verified live: a
 * product with `currency_minor_unit: 2` and `prices.price: "190000"` renders as ₨1,900.00 in the
 * store's own `price_html`) — dividing by 10^currency_minor_unit is required, not optional.
 */
const toPrice = (product: NeptronicsProduct): number | null => {
  const raw = Number(product.prices.price);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw / 10 ** (product.prices.currency_minor_unit ?? 2);
};

// Neptronics has no brand taxonomy at all (`brands: []` on every product, confirmed live) — this
// is a best-effort guess from the product title's own brand-name prefix, covering the brands
// actually seen in this store's real catalog. When none match, brand is left undefined rather
// than guessing wrong; the matcher still works on name text alone (see collectors/core/matcher.ts).
const KNOWN_BRAND_PREFIX = /^(fantech|xiaomi|redmi|soundcore|anker|jbl|boat|sony|samsung|zeblaze|oraimo|rapoo|ewa|fineblue|havit|redragon|logitech|hp|dell|sandisk|kingston|wd|western digital|sjcam|digitek|boya|amazfit|mi\b)/i;

function guessBrand(name: string): string | undefined {
  const match = name.match(KNOWN_BRAND_PREFIX);
  return match ? match[0].toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined;
}

export function parseNeptronicsProduct(product: NeptronicsProduct): StoreProduct | null {
  const price = toPrice(product);
  if (!price) return null;
  const name = decodeHtml(product.name);
  return {
    externalId: product.slug,
    name,
    brand: guessBrand(name),
    price,
    currency: "NPR",
    imageUrl: product.images?.[0]?.src,
    productUrl: product.permalink,
    availability: product.is_in_stock === undefined ? "unknown" : product.is_in_stock ? "in_stock" : "out_of_stock",
  };
}

export function parseNeptronicsProducts(products: NeptronicsProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseNeptronicsProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}
