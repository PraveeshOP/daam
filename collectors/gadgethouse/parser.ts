import type { StoreProduct } from "@/collectors/evo/types";

export type GadgetHouseProduct = {
  id: number;
  name: string;
  permalink: string;
  sku?: string;
  prices: { price: string; sale_price?: string; currency_minor_unit: number };
  images?: { src?: string }[];
  brands?: { name: string }[];
  is_in_stock?: boolean;
};

/** Same general numeric-entity decoder as collectors/lds/parser.ts and
 * collectors/yantranepal/parser.ts — verified live that 20/73 sampled Gadget House product names
 * contain literal numeric entities (en-dash, inch marks, ampersand). */
const decodeHtml = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();

/**
 * Verified live: `sku` is blank on 53/73 (73%) of this category's products, and the remaining 20
 * are free-text descriptive copies of the product name rather than real inventory codes — never
 * trusted, per this codebase's established rule. `brands[]` exists (unlike Yantra Nepal) but is
 * only populated on ~16% of products (all Xiaomi/MI), so it's used when present but backed by a
 * known-brand-prefix guess from the name for everything else, same approach as
 * collectors/neptronics/parser.ts.
 */
const KNOWN_BRAND_PREFIX = /^(kieslect|amazfit|noise|hoco|xiaomi|mi\b|samsung|huawei|honor|oraimo|zeblaze|cmf|boat|realme|oppo|vivo|redmi|fire-?boltt|boult)/i;
function guessBrand(name: string, brands?: { name: string }[]): string | undefined {
  if (brands?.[0]?.name) return brands[0].name;
  const match = name.match(KNOWN_BRAND_PREFIX);
  return match ? match[0].toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined;
}

function toPrice(product: GadgetHouseProduct): number | null {
  const salePrice = Number(product.prices.sale_price);
  const listPrice = Number(product.prices.price);
  const minorUnit = 10 ** (product.prices.currency_minor_unit ?? 2);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  return Number.isFinite(price) && price > 0 ? price / minorUnit : null;
}

export function parseGadgetHouseProduct(product: GadgetHouseProduct): StoreProduct | null {
  const price = toPrice(product);
  if (!price) return null;
  return {
    externalId: String(product.id),
    name: decodeHtml(product.name),
    brand: guessBrand(product.name, product.brands),
    price,
    currency: "NPR",
    imageUrl: product.images?.[0]?.src,
    productUrl: product.permalink,
    availability: product.is_in_stock === undefined ? "unknown" : product.is_in_stock ? "in_stock" : "out_of_stock",
  };
}

export function parseGadgetHouseProducts(products: GadgetHouseProduct[], limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of products) {
    const row = parseGadgetHouseProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via /wp-json/wc/store/v1/products/categories (a paginated endpoint — the
 * Smartwatch category sits on page 2 of 2, easy to miss at per_page=100 with 175 total
 * categories): id 45, slug "smartwatch", parent "Mobile and Accessories", count 73, 70 in stock.
 * Only one small brand subcategory (Amazfit, 19) nests under it — negligible overlap, unlike
 * Yantra Nepal's laptop category.
 */
export const GADGETHOUSE_SMARTWATCH_CATEGORY_ID = 45;
