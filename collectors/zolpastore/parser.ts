import type { Availability, StoreProduct } from "@/collectors/evo/types";

type JsonLdOffer = { url?: string; price?: string | number; priceCurrency?: string; availability?: string };
type JsonLdProduct = {
  "@type"?: string;
  name?: string;
  description?: string;
  category?: string;
  brand?: { name?: string } | string;
  offers?: JsonLdOffer;
};

const decodeHtml = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
const toPrice = (value: string | number | undefined) => {
  const price = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(price) && price > 0 ? price : null;
};
const toAvailability = (value?: string): Availability => (value?.toLowerCase().includes("outofstock") ? "out_of_stock" : value?.toLowerCase().includes("instock") ? "in_stock" : "unknown");
const brandName = (brand?: { name?: string } | string) => (typeof brand === "string" ? brand : brand?.name)?.trim();

/** Every real product name on this site ends with a "Price in Nepal" SEO suffix (verified across
 * every sample fetched) — same "strip the marketing suffix" idea as Mobilemandu's pipe-split
 * (collectors/mobilemandu/parser.ts), different literal pattern on this site. */
const cleanName = (name: string) => decodeHtml(name).replace(/\s*price in nepal\s*$/i, "").trim();

function extractJsonLdProduct(html: string): JsonLdProduct | undefined {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim()) as JsonLdProduct;
      if (parsed?.["@type"] === "Product") return parsed;
    } catch {
      // One malformed JSON-LD block should not invalidate the page.
    }
  }
  return undefined;
}

/**
 * The JSON-LD `image` field is always an empty array on this site (verified live across every
 * category sampled — laptop, gaming PC, phone, earbuds — not a sporadic bug), and `og:image` is
 * always the site-wide default logo, not the product photo. The real per-product image is only
 * reachable via this site's internal Next.js RSC data (a much larger, more fragile parse: decode
 * and concatenate ~688 `self.__next_f.push([1,"..."])` chunks per page, then locate a
 * `"ProductDetails":[{...}]` substring). This preload `<link>` — verified live and distinct
 * across every product sampled — is Next.js's own priority-image hint for the page's hero photo,
 * giving the same real image with a single cheap regex instead of that RSC parse.
 */
function extractPreloadImage(html: string): string | undefined {
  return html.match(/<link rel="preload" as="image" href="([^"]+)"/)?.[1];
}

/**
 * Zolpa Store's `sku` is a giant slugified concatenation of the full product title, spec string,
 * and color (verified live — never a clean code, and it changes per RAM/variant on the same base
 * product) — never trusted as an identifier, consistent with this codebase's established rule.
 * The URL slug is the stable id here, same fallback used for Neostore (collectors/neostore/parser.ts)
 * when a site's own identifiers turn out to be unusable.
 */
export function parseZolpastoreProduct(html: string, productUrl: string, expectedCategory: RegExp): StoreProduct[] {
  const product = extractJsonLdProduct(html);
  if (!product?.name) throw new Error("missing product JSON-LD or name");
  const category = (product.category || "").trim();
  if (!expectedCategory.test(category)) throw new Error(`unexpected category (expected ${expectedCategory}, got: ${category || "unknown"})`);

  const price = toPrice(product.offers?.price);
  if (!price) throw new Error("missing or invalid price");
  const externalId = new URL(productUrl).pathname.replace(/^\/shop\//, "").replace(/\/$/, "");

  return [{
    externalId,
    name: cleanName(product.name),
    brand: brandName(product.brand),
    price,
    currency: "NPR",
    imageUrl: extractPreloadImage(html),
    productUrl: product.offers?.url || productUrl,
    availability: toAvailability(product.offers?.availability),
    description: product.description ? decodeHtml(product.description) : undefined,
  }];
}

const LAPTOP_URL_HINT = /(laptop|notebook|macbook|thinkpad|ideapad|vivobook|zenbook|pavilion|inspiron|probook|elitebook|legion|nitro|predator|swift|aspire|chromebook|zbook|omen|victus|\bloq\b|tuf-gaming|rog-)/i;
const LAPTOP_URL_EXCLUDE = /(stand|bag\b|backpack|sleeve|skin\b|cover|case-|charger|power-?bank|adapter|cooling|mat\b|dock\b|hub\b|sticker|decal|screen-guard|mouse\b|keyboard-cover|table\b|desk\b|riser|fan\b|cable|headset|controller|monitor|build-your-gaming-pc|build-gaming-pc)/i;

export function parseZolpastoreProductUrls(sitemapXml: string, limit: number): string[] {
  return [...sitemapXml.matchAll(/<url>\s*<loc>\s*(https:\/\/zolpastore\.com\/shop\/[^<\s]+)\s*<\/loc>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url) => LAPTOP_URL_HINT.test(url) && !LAPTOP_URL_EXCLUDE.test(url))
    .slice(0, limit);
}

export const ZOLPASTORE_LAPTOP_CATEGORY = /^laptop$/i;
