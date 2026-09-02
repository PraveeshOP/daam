import type { StoreProduct } from "@/collectors/evo/types";
import { extractLaptopRamStorage } from "@/collectors/core/specs";

type OnlineItCategory = { id: number; name: string };
export type OnlineItProduct = {
  id: number;
  name: string;
  permalink: string;
  sku?: string;
  prices: { price: string; sale_price?: string; currency_minor_unit: number };
  images?: { src?: string }[];
  categories?: OnlineItCategory[];
  is_in_stock?: boolean;
};

/** Same general numeric-entity decoder as collectors/lds/parser.ts and others — verified live
 * this site's product names contain literal numeric entities (e.g. `13.8&#8243; PixelSense`). */
const decodeHtml = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();

/** Verified live: `brands` is empty (`[]`) on every product on this site — brand is derived from
 * a known-brand entry in `categories[]` instead (every laptop is filed under both a marketing
 * category like "16 GB RAM Laptop" and its own bare brand name, e.g. {"name":"Acer"}). */
const KNOWN_LAPTOP_BRANDS = new Set(["asus", "dell", "lenovo", "hp", "acer", "apple", "msi", "huawei", "honor", "infinix", "chuwi", "microsoft", "samsung", "lg", "gigabyte", "razer", "toshiba", "fujitsu", "gateway"]);
function brandFromCategories(categories?: OnlineItCategory[]): string | undefined {
  const match = categories?.find((category) => KNOWN_LAPTOP_BRANDS.has(category.name.trim().toLowerCase()));
  return match?.name.trim();
}

/**
 * `sku` is blank on 19/20 sampled products (verified live) — the numeric `id` is used instead,
 * this codebase's established rule. Also verified live: at least one real product (a Microsoft
 * Surface listing) has `price: "0"` across price/regular_price/sale_price — a broken/unpublished
 * listing, not a genuinely free laptop — dropped by the same "no usable positive price" guard
 * every other collector in this codebase already applies.
 */
function toPrice(product: OnlineItProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

export function parseOnlineItProduct(product: OnlineItProduct): StoreProduct | null {
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

export function parseOnlineItProducts(products: OnlineItProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseOnlineItProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via /wp-json/wc/store/v1/products/categories (a 133-category, 2-page listing on
 * this site — a naive per_page=100 fetch truncates and can miss brand-child categories used for
 * verification): "laptops" (id 108, count 477-479, live-drifting) is the umbrella whose
 * brand-children sum almost exactly to its own count (Acer 114 + Dell 104 + Apple 23 + Asus 53 +
 * HP 44 + Lenovo 75 + MSI 61 + Microsoft 2 = 476 vs 477) — sibling marketing categories like
 * "Gaming Laptops" or "Under 2 Lakh" overlap heavily and are NOT children; fetch by 108 directly.
 */
export const ONLINEIT_LAPTOP_CATEGORY_ID = 108;
