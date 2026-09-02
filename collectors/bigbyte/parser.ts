import type { StoreProduct } from "@/collectors/evo/types";

export type BigbyteProduct = {
  id: number;
  name: string;
  permalink: string;
  sku?: string;
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
 * `brands[]` is empty on every product in this category (verified live, 86/86) — brand is
 * derived from the name's first word instead. Verified live this catalog uses two different
 * spellings for the same manufacturer — "UNV" (47 products) and "UNIVIEW" (5 products) are both
 * Uniview's own brand, just written differently across listings — normalized to one canonical
 * name rather than treated as two separate brands.
 */
const BRAND_ALIASES: Record<string, string> = { unv: "Uniview", uniview: "Uniview" };
function guessBrand(name: string): string | undefined {
  const firstWord = name.split(/\s+/)[0]?.toLowerCase();
  if (!firstWord) return undefined;
  return BRAND_ALIASES[firstWord] || (/^[a-z]+$/i.test(firstWord) ? firstWord.replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined);
}

/** `sku` looks superficially reliable here (unique, non-blank on every sampled product) but is
 * format-inconsistent (some wrapped in stray parentheses, e.g. "(DG-I404B)") — per this
 * codebase's rule, the numeric `id` is used regardless. */
function toPrice(product: BigbyteProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

/**
 * Verified live: despite being named "IP Cameras / Network Cameras", this category also carries
 * 4 NVR/DVR/XVR recorder listings (not cameras) alongside 82 genuine cameras — WooCommerce
 * category membership isn't mutually exclusive, so a recorder can share this tag. Excluded by
 * name rather than trusting the category label alone.
 */
const NOT_A_CAMERA = /\b(nvr|xvr|dvr)\b/i;

export function parseBigbyteProduct(product: BigbyteProduct): StoreProduct | null {
  if (NOT_A_CAMERA.test(product.name)) return null;
  const price = toPrice(product);
  if (!price) return null;
  const name = decodeHtml(product.name);
  return {
    externalId: String(product.id),
    name,
    brand: product.brands?.[0]?.name || guessBrand(name),
    price,
    currency: "NPR",
    imageUrl: product.images?.[0]?.src,
    productUrl: product.permalink,
    availability: product.is_in_stock === undefined ? "unknown" : product.is_in_stock ? "in_stock" : "out_of_stock",
  };
}

export function parseBigbyteProducts(products: BigbyteProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseBigbyteProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via /wp-json/wc/store/v1/products/categories (a 113-category, 2-page listing):
 * "IP Cameras / Network Cameras" (id 13546, count 86) is the correct target, not its parent
 * "Surveillance" (id 492, count 138 — the extra 52 are NVRs/XVRs/VMS software, not cameras) and
 * not "Home Appliances" (id 484, count 13 — mostly a handful of Smart TVs, 6 of 9 out of stock,
 * plus a mosquito lamp and sewing machines; no AC/fridge/washer category exists on this site at
 * all). 86/86 products in this category are confirmed in stock.
 */
export const BIGBYTE_CAMERA_CATEGORY_ID = 13546;
