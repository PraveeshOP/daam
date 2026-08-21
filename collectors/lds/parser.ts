import type { StoreProduct } from "@/collectors/evo/types";

export type LdsProduct = {
  id: number;
  name: string;
  permalink: string;
  sku?: string;
  prices: { price: string; sale_price?: string; currency_minor_unit: number };
  images?: { src?: string }[];
  brands?: { name: string }[];
  is_in_stock?: boolean;
};

/**
 * A general numeric-entity decoder (`&#NNN;`) rather than a hand-enumerated list — verified live
 * that a hardcoded list misses real cases (e.g. `&#038;` for "&" in "Silver, Blush &#038; Indigo",
 * caught only by actually checking an imported row, not by inspecting the sampled JSON snippets
 * ahead of time). Named entities still need their own mapping since they aren't numeric.
 */
const decodeHtml = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();

/**
 * `sku` values on this site actually look reasonably clean at a glance (e.g. "lenovo-131",
 * "Acer-100") — unlike Neptronics/SmartDoko, where sku was flatly unreliable — but this codebase's
 * established rule is to never trust a free-text SKU as the join key regardless, since every
 * other store that looked fine on a small sample turned out to have at least one edge case (blank,
 * reused, or a restated internal id). The Store API's own numeric `id` is unique per product
 * (verified: every sampled product here is `type: "simple"` with `has_options: false`, i.e. no
 * variant explosion to worry about in the first place).
 */
function toPrice(product: LdsProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

/**
 * Verified live: LDS itself lists a product (id 4182) as "Apple MacBook Neo A18 Pro Chip .../Mac
 * OS" under the "Apple" brand — but the A18 Pro is an iPhone chip, never used in any real Mac
 * (Apple's laptop line runs M-series Apple Silicon, M1 through M5), and its price (~NPR 127,000)
 * is far below any genuine current MacBook. This reads as a mislabeled or counterfeit listing on
 * LDS's own site, not a real Apple product — importing it under the "Apple" brand into a
 * price-comparison catalog would actively mislead a shopper into thinking it's a genuine MacBook
 * at a bargain price, so it's excluded by name pattern rather than passed through as-is.
 */
const FAKE_APPLE_SILICON_PATTERN = /\ba1[0-9]\b.*(?:mac\s?os|macbook)|macbook.*\ba1[0-9]\b/i;

export function parseLdsProduct(product: LdsProduct): StoreProduct | null {
  if (FAKE_APPLE_SILICON_PATTERN.test(product.name)) return null;
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

export function parseLdsProducts(products: LdsProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseLdsProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}
