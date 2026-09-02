import type { StoreProduct } from "@/collectors/evo/types";
import { extractLaptopRamStorage } from "@/collectors/core/specs";

type MaxCategory = { id: number; name: string };
export type MaxProduct = {
  id: number;
  name: string;
  permalink: string;
  sku?: string;
  prices: { price: string; sale_price?: string; currency_minor_unit: number };
  images?: { src?: string }[];
  categories?: MaxCategory[];
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
 * Verified live: `brands` is empty (`[]`) on every product on this site — brand is derived from
 * categories[] instead, but unlike Online IT/Yantra Nepal (bare "Acer"), this site's brand
 * categories are suffixed ("Acer Laptops", "Microsoft Laptops"), matching Infotechs Nepal's
 * pattern — a prefix match, not an exact-name Set.
 */
const KNOWN_LAPTOP_BRAND_PREFIX = /^(asus|dell|lenovo|hp|acer|apple|msi|huawei|honor|infinix|chuwi|microsoft|samsung|lg|gigabyte|razer|toshiba|fujitsu|gateway)\b/i;
function brandFromCategories(categories?: MaxCategory[]): string | undefined {
  for (const category of categories || []) {
    const match = category.name.match(KNOWN_LAPTOP_BRAND_PREFIX);
    if (match) return match[0].toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return undefined;
}

/** `sku` is blank on every product sampled (verified live, 20/20) — use the numeric `id` instead. */
function toPrice(product: MaxProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

export function parseMaxProduct(product: MaxProduct): StoreProduct | null {
  const price = toPrice(product);
  if (!price) return null;
  const name = decodeHtml(product.name);
  const { ram, storage } = extractLaptopRamStorage(name);
  return {
    externalId: String(product.id),
    name,
    brand: brandFromCategories(product.categories),
    ram,
    storage,
    price,
    currency: "NPR",
    imageUrl: product.images?.[0]?.src,
    productUrl: product.permalink,
    availability: product.is_in_stock === undefined ? "unknown" : product.is_in_stock ? "in_stock" : "out_of_stock",
  };
}

export function parseMaxProducts(products: MaxProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseMaxProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via /wp-json/wc/store/v1/products/categories — a 141-category, 2-page listing on
 * this site (a naive per_page=100 fetch truncates and misses page-2 brand categories like MSI/
 * Microsoft, needed to correctly verify this id): "laptops" (id 276, count 381) is the umbrella,
 * whose brand-children sum to 380 of 381 — near-exact, confirming this is the right id to fetch.
 */
export const MAX_LAPTOP_CATEGORY_ID = 276;
