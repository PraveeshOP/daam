import type { Availability, StoreProduct } from "@/collectors/evo/types";
import { extractLaptopRamStorage } from "@/collectors/core/specs";

export type ComputerPlanetProduct = {
  id: number;
  sku?: string;
  name: string;
  slug: string;
  price?: string;
  sale_price?: string;
  stock_status?: "instock" | "outofstock";
  featured_image_url?: string;
};
export type ComputerPlanetProductsResponse = { data?: { data?: ComputerPlanetProduct[]; total_items?: number } };


/**
 * The API's own `brand` field is unreliable for this purpose — verified live it returns a
 * sub-series ("Aspire series", "Legion series"), not the manufacturer ("Acer", "Lenovo"), and the
 * true hierarchy requires a separate `/api/v1/brands` lookup the embedded object doesn't even
 * preserve `parent_id` for. Every sampled product name starts with the real manufacturer instead
 * (verified across 10 real products), so this reads brand from the name directly rather than
 * adding a second request per product just to walk a brand tree.
 */
const KNOWN_LAPTOP_BRAND_PREFIX = /^(asus|dell|lenovo|hp|acer|apple|msi|huawei|honor|infinix|chuwi|microsoft|samsung|lg|gigabyte|razer|toshiba|fujitsu)\b/i;
function guessBrand(name: string): string | undefined {
  const match = name.match(KNOWN_LAPTOP_BRAND_PREFIX);
  return match ? match[0].toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined;
}

/**
 * Never key on `sku` — this codebase's established rule, even though sku looked clean in-sample
 * here (0 blanks/duplicates across 167 products checked): every other Nepal store this session
 * that looked clean in a small sample eventually had an edge case (Gadget House's smartwatch skus
 * were 73% blank). The numeric `id` is used instead.
 */
export function parseComputerPlanetProduct(product: ComputerPlanetProduct): StoreProduct | null {
  const salePrice = Number(product.sale_price);
  const listPrice = Number(product.price);
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : listPrice;
  if (!Number.isFinite(price) || price <= 0) return null;

  const { ram, storage } = extractLaptopRamStorage(product.name);
  const availability: Availability = product.stock_status === "instock" ? "in_stock" : product.stock_status === "outofstock" ? "out_of_stock" : "unknown";

  return {
    externalId: String(product.id),
    name: product.name.trim(),
    brand: guessBrand(product.name),
    ram,
    storage,
    price,
    currency: "NPR",
    imageUrl: product.featured_image_url,
    productUrl: `https://cplanetnp.com/${product.slug}`,
    availability,
  };
}

export function parseComputerPlanetProducts(response: ComputerPlanetProductsResponse, limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of response.data?.data || []) {
    const row = parseComputerPlanetProduct(product);
    if (row) rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Verified live via /api/v1/categories: "Laptops" (id 1) is the umbrella, count 167 — its
 * brand/use-case subcategories (Gaming 57, Business 24, Ultrabook 38, 2-in-1 15, MacBook 12,
 * Traditional 37 — sum 183) overlap it, same pattern as every other Nepal site this session.
 * `category=laptops-nepal`/`category=1` are silently ignored by the API — must use
 * `category_id`, verified live.
 */
export const COMPUTERPLANET_LAPTOP_CATEGORY_ID = 1;
