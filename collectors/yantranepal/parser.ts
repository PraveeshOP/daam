import type { StoreProduct } from "@/collectors/evo/types";

type YantraCategory = { id: number; name: string };
export type YantraProduct = {
  id: number;
  name: string;
  permalink: string;
  sku?: string;
  prices: { price: string; sale_price?: string; currency_minor_unit: number };
  images?: { src?: string }[];
  categories?: YantraCategory[];
  is_in_stock?: boolean;
};

/**
 * A general numeric-entity decoder (`&#NNN;`) rather than a hand-enumerated list — same lesson
 * learned live on collectors/lds/parser.ts, where a hardcoded list missed a real `&#038;` case.
 * Verified live here too: 92/100 sampled Yantra product names contain literal numeric entities
 * (mostly `&#8243;` double-prime and `&#215;` ×), so this must actually run, not be a rare corner
 * case.
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
 * Verified live: this site's Store API response has NO `brands` field at all (not empty — the
 * key is entirely absent), unlike most other WooCommerce sites this codebase has integrated. Brand
 * is only inferable from `categories[]`, where each product is also tagged with a brand-name
 * category (e.g. {"name":"Asus"}, {"name":"Dell"}) alongside the laptop-umbrella and various
 * overlapping spec/use-case tags ("i7 Laptops", "Business Use Laptops") — so this matches against
 * a known-brand allow-list rather than trusting any arbitrary category name as a brand.
 */
const KNOWN_LAPTOP_BRANDS = new Set(["asus", "dell", "lenovo", "hp", "acer", "apple", "msi", "huawei", "honor", "infinix", "chuwi", "microsoft", "samsung", "lg", "gigabyte", "razer", "toshiba", "fujitsu"]);
function brandFromCategories(categories?: YantraCategory[]): string | undefined {
  const match = categories?.find((category) => KNOWN_LAPTOP_BRANDS.has(category.name.trim().toLowerCase()));
  return match?.name.trim();
}

/**
 * Extracts RAM/storage from names like "16GB DDR5 4800MHz RAM, 512GB Gen 4 SSD" as their own
 * StoreProduct fields — the matcher's generic fallback regex only grabs the FIRST GB/TB figure in
 * a name (see the fix and regression test in collectors/core/matcher.ts/test.ts, found live on
 * DealAyo's near-identical "12GB RAM 512GB Storage" phone names), which here would be the RAM
 * figure, not storage; two laptop configs that share RAM but differ only in storage would
 * otherwise risk being silently treated as the same product. Storage is matched by drive-type
 * keyword (SSD/HDD/NVMe/eMMC) rather than a literal "storage" word, since that's how this site's
 * own names phrase it.
 */
function extractRamStorage(name: string): { ram?: string; storage?: string } {
  const ram = name.match(/(\d+(?:\.\d+)?\s*(?:gb|tb))(?:\s+\S+){0,2}?\s*ram\b/i)?.[1];
  const storage = name.match(/(\d+(?:\.\d+)?\s*(?:gb|tb))(?:\s+\S+){0,2}?\s*(?:ssd|hdd|nvme|emmc)\b/i)?.[1];
  return { ram: ram?.replace(/\s+/g, "").toUpperCase(), storage: storage?.replace(/\s+/g, "").toUpperCase() };
}

/**
 * Never trust `sku` — this codebase's established rule, holding again here: sequential-looking
 * codes (EDN2100, EDN2101, ...) were clean in a ~900-product sample, but that's an in-sample
 * observation, not a guarantee across the full 1241-product catalog (Gadget House's smartwatch
 * SKUs looked fine in isolation too, until 73% turned out blank — collectors/gadgethouse/parser.ts).
 * The numeric `id` is the one field that's actually guaranteed unique by the platform itself.
 */
function toPrice(product: YantraProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

export function parseYantraProduct(product: YantraProduct): StoreProduct | null {
  const price = toPrice(product);
  if (!price) return null;
  const { ram, storage } = extractRamStorage(product.name);
  return {
    externalId: String(product.id),
    name: decodeHtml(product.name),
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

export function parseYantraProducts(products: YantraProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseYantraProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via /wp-json/wc/store/v1/products/categories: the "Laptops" umbrella (id 530,
 * count 769) is heavily overlap-tagged with ~26 brand/spec/use-case subcategories whose counts
 * sum to 2243 — nearly 3x the parent's own count, since one laptop gets tagged under its brand,
 * processor tier, and use-case simultaneously. Fetch by the umbrella id directly; never sum
 * children expecting them to add up to the parent (unlike the "TVs" case on smartdoko.com, where
 * they did).
 */
export const YANTRA_LAPTOP_CATEGORY_ID = 530;
