import type { StoreProduct } from "@/collectors/evo/types";

export type TronixspaceProduct = {
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

/** `sku` is blank on every product sampled (verified live, including the site's single PS5
 * listing) — use the numeric `id` instead. Unlike the laptop-focused WooCommerce sites this
 * session, `brands[]` IS reliably populated here (Sony, Rapoo, XTRIKE ME all confirmed real). */
function toPrice(product: TronixspaceProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

export function parseTronixspaceProduct(product: TronixspaceProduct): StoreProduct | null {
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

export function parseTronixspaceProducts(products: TronixspaceProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseTronixspaceProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via /wp-json/wc/store/v1/products/categories: the leaf "Gaming Consoles" (id 79)
 * has genuinely only 1 real product (a PS5) — too thin to build a collector around on its own.
 * The parent "Gaming" (id 78, count 4) sums exactly from its children (1 console + 2 controllers
 * + 1 headset, no overlap) and is used here instead, for more real depth per collector run — the
 * PS5 listing itself is still included, just alongside 3 real gaming-peripheral SKUs rather than
 * fetched in isolation.
 */
export const TRONIXSPACE_GAMING_CATEGORY_ID = 78;
