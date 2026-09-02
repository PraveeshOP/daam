import type { StoreProduct } from "@/collectors/evo/types";

export type MeroepasalProduct = {
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

/** `brands[]` is populated on most products (Voltas, FABER, BALTRA, KENT, ZeroB all confirmed
 * real) but not all — a real Hisense washing machine had `brands: []` — so this falls back to a
 * known-brand prefix in the name when the field is empty. */
const KNOWN_APPLIANCE_BRAND_PREFIX = /^(lg|samsung|hitachi|whirlpool|ifb|haier|panasonic|sharp|walton|baltra|videocon|godrej|electrolux|bosch|toshiba|singer|midea|tcl|vestar|voltas|daikin|faber|kent|zerob|aucma|hisense|cg|comfee|innmotek)/i;
function guessBrand(name: string, brands?: { name: string }[]): string | undefined {
  if (brands?.[0]?.name) return brands[0].name;
  const match = name.match(KNOWN_APPLIANCE_BRAND_PREFIX);
  return match ? match[0].toUpperCase() : undefined;
}

/** `sku` is blank on every product sampled across all 4 categories (verified live, 20+ products)
 * — use the numeric `id` instead. */
function toPrice(product: MeroepasalProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

export function parseMeroepasalProduct(product: MeroepasalProduct): StoreProduct | null {
  const price = toPrice(product);
  if (!price) return null;
  const name = decodeHtml(product.name);
  return {
    externalId: String(product.id),
    name,
    brand: guessBrand(name, product.brands),
    price,
    currency: "NPR",
    imageUrl: product.images?.[0]?.src,
    productUrl: product.permalink,
    availability: product.is_in_stock === undefined ? "unknown" : product.is_in_stock ? "in_stock" : "out_of_stock",
  };
}

export function parseMeroepasalProducts(products: MeroepasalProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseMeroepasalProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via /wp-json/wc/store/v1/products/categories: this app's single "home-appliances"
 * bucket maps to FOUR separate, clean leaf categories on this site — Air Conditioners (425, 22),
 * Refrigerators (94, 74), Washing Machines (106, 51), Water Purifiers (201, 46), ~193 real
 * products total. The umbrella "Home Appliances" (id 48, count 726) sums exactly from ITS
 * children with no dilution, but pulls in many unrelated kitchen categories (toasters,
 * dishwashers, ice makers) this app has no bucket for — these 4 leaves are the actual overlap.
 *
 * A naming trap found live: id 423 is labeled "Refrigeration" but its real contents are ice
 * makers/wine coolers/deep freezers, NOT household fridges — the real fridge category is id 94
 * ("Refrigerators", nested under Kitchen Appliances). Never use 423 for this purpose.
 */
export const MEROEPASAL_APPLIANCE_CATEGORY_IDS = [425, 94, 106, 201];
