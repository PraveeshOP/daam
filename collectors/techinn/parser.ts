import type { StoreProduct } from "@/collectors/evo/types";
import { extractLaptopRamStorage } from "@/collectors/core/specs";

type TechinnCategory = { id: number; name: string };
export type TechinnProduct = {
  id: number;
  name: string;
  permalink: string;
  sku?: string;
  prices: { price: string; sale_price?: string; currency_minor_unit: number };
  images?: { src?: string }[];
  categories?: TechinnCategory[];
  is_in_stock?: boolean;
};

/** Same general numeric-entity decoder as collectors/lds/parser.ts and
 * collectors/yantranepal/parser.ts — verified live that this site's product names contain literal
 * numeric entities (e.g. "6-core CPU &#038; 5-core GPU"), present in the raw Store API JSON
 * itself, not just scraped HTML. */
const decodeHtml = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();


/**
 * Verified live: this site's Store API response has no `brands` field at all — brand is derived
 * from a known-brand entry in `categories[]` instead (every laptop is filed under both "Laptops"
 * and its own brand subcategory, e.g. {"name":"Lenovo"}), same approach as
 * collectors/yantranepal/parser.ts (a different, unrelated site with the identical gap).
 */
const KNOWN_LAPTOP_BRANDS = new Set(["asus", "dell", "lenovo", "hp", "acer", "apple", "msi", "mi", "huawei", "honor", "infinix", "chuwi", "microsoft", "samsung", "lg", "gigabyte", "razer", "toshiba", "fujitsu"]);
function brandFromCategories(categories?: TechinnCategory[]): string | undefined {
  const match = categories?.find((category) => KNOWN_LAPTOP_BRANDS.has(category.name.trim().toLowerCase()));
  return match?.name.trim();
}

/** `sku` is blank on every product on this site (verified live, no exceptions across the sample)
 * — use the numeric `id` instead, this codebase's established rule. */
function toPrice(product: TechinnProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

export function parseTechinnProduct(product: TechinnProduct): StoreProduct | null {
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

export function parseTechinnProducts(products: TechinnProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseTechinnProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via /wp-json/wc/store/v1/products/categories: "Laptops" (id 16, count 84) is a
 * clean umbrella whose brand-subcategory children sum exactly to its own count (Acer 21 + Apple 4
 * + Asus 9 + Dell 12 + HP 7 + Lenovo 26 + Mi 4 + Ripple 1 = 84) — no overlap-tagging risk like
 * Yantra Nepal's Laptops category on a different site.
 */
export const TECHINN_LAPTOP_CATEGORY_ID = 16;
