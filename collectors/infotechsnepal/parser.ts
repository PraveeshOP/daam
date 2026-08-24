import type { StoreProduct } from "@/collectors/evo/types";
import { extractLaptopRamStorage } from "@/collectors/core/specs";

type InfotechsCategory = { id: number; name: string };
export type InfotechsProduct = {
  id: number;
  name: string;
  permalink: string;
  sku?: string;
  prices: { price: string; sale_price?: string; currency_minor_unit: number };
  images?: { src?: string }[];
  brands?: { name: string }[];
  categories?: InfotechsCategory[];
  is_in_stock?: boolean;
};

/** Same general numeric-entity decoder as collectors/lds/parser.ts and
 * collectors/yantranepal/parser.ts — verified live that this site mixes literal numeric entities
 * (`&#8243;`) and already-decoded unicode (`″`) across different products, so this must handle
 * both without assuming either is exclusive. */
const decodeHtml = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();


/**
 * Verified live: `brands` was empty (`[]`) on the sampled product, so brand is derived from
 * `categories[]` instead — but unlike Yantra Nepal/Techinn (bare brand names like "Acer"), this
 * site's brand categories are suffixed ("Acer Laptops", "Lenovo Laptops"), so this matches a
 * known-brand PREFIX at the start of the category name rather than an exact-match set.
 */
const KNOWN_LAPTOP_BRAND_PREFIX = /^(asus|dell|lenovo|hp|acer|apple|msi|huawei|honor|infinix|chuwi|microsoft|samsung|lg|gigabyte|razer|toshiba|fujitsu)\b/i;
function brandFromCategories(categories?: InfotechsCategory[]): string | undefined {
  for (const category of categories || []) {
    const match = category.name.match(KNOWN_LAPTOP_BRAND_PREFIX);
    if (match) return match[0].toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return undefined;
}

/** `sku` is blank on every product sampled (verified live) — use the numeric `id` instead, this
 * codebase's established rule. */
function toPrice(product: InfotechsProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

export function parseInfotechsProduct(product: InfotechsProduct): StoreProduct | null {
  const price = toPrice(product);
  if (!price) return null;
  const name = decodeHtml(product.name);
  const { ram, storage } = extractLaptopRamStorage(name);
  return {
    externalId: String(product.id),
    name,
    brand: product.brands?.[0]?.name || brandFromCategories(product.categories),
    ram,
    storage,
    price,
    currency: "NPR",
    imageUrl: product.images?.[0]?.src,
    productUrl: product.permalink,
    availability: product.is_in_stock === undefined ? "unknown" : product.is_in_stock ? "in_stock" : "out_of_stock",
  };
}

export function parseInfotechsProducts(products: InfotechsProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseInfotechsProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via /wp-json/wc/store/v1/products/categories: "Laptops" (id 291) is heavily
 * overlap-tagged across ~30 brand/CPU/use-case subcategories (children sum well over the parent's
 * own count) — the same pattern as Yantra Nepal and Techinn, on yet another unrelated site. Fetch
 * by the umbrella id directly; never sum children.
 */
export const INFOTECHS_LAPTOP_CATEGORY_ID = 291;
