import type { StoreProduct } from "@/collectors/evo/types";

export type SewasmartProduct = {
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
 * `sku` is blank on 72% of products sampled (44/61, verified live) — use the numeric `id`
 * instead. `currency_minor_unit` is 0 on this site (verified live: `price:"65000"` already means
 * ₨65,000) — DIFFERENT from Bigbyte/most other WooCommerce sites this session, which use 2. Never
 * hardcode the divisor; always read it from the response.
 */
function toPrice(product: SewasmartProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

export function parseSewasmartProduct(product: SewasmartProduct): StoreProduct | null {
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

export function parseSewasmartProducts(products: SewasmartProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseSewasmartProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via /wp-json/wc/store/v1/products/categories (77 categories, confirmed complete
 * on one page): "Air Conditioner" (id 78, count 61) is the umbrella — its 12 capacity/tech/brand
 * subcategories sum to 149, far exceeding the parent (each AC is cross-tagged by capacity, tech,
 * AND brand simultaneously) — fetch by 78 directly, never sum children. Confirmed clean of the
 * site's non-electronics drift (pool/water-filter/solar categories all sit elsewhere, untouched).
 */
export const SEWASMART_AC_CATEGORY_ID = 78;
