import type { Availability, StoreProduct } from "@/collectors/evo/types";

type JsonLdOffer = { url?: string; priceCurrency?: string; price?: string | number; availability?: string };
type JsonLdVariant = {
  "@type"?: string;
  name?: string;
  sku?: string;
  color?: string;
  brand?: { name?: string } | string;
  additionalProperty?: { name?: string; value?: string }[];
  offers?: JsonLdOffer;
};
type JsonLdProductGroup = {
  "@type"?: string;
  name?: string;
  description?: string;
  image?: string | string[];
  brand?: { name?: string } | string;
  category?: string;
  hasVariant?: JsonLdVariant[];
};

// Same zero-width-character defense as collectors/mobilemandu/parser.ts, plus a literal-CRLF
// collapse — verified live, at least one real Hukut product name has a raw "\r\n\r\n" glued into
// it (e.g. "Lenovo LOQ 15AHP9 (...)\r\n\r\n  – Luna Grey, ..."), same class of messy-slug issue the
// recon already flagged for this site's URLs.
const stripInvisible = (value: string) => value.replace(/[​-‏⁠-⁤﻿]/g, "");
const decodeHtml = (value: string) => stripInvisible(value).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/**
 * Verified live: at least one real Hukut product description has raw chat-assistant-UI HTML
 * leaked into it (CSS classes like "threadScrollVars", attributes like `data-turn-id`,
 * `data-testid="conversation-turn-254"`) — almost certainly someone at Hukut copy-pasting text
 * out of an AI chat interface into their CMS, not anything this codebase generated or an
 * instruction directed at this collector. It reads as page markup, not text, so plain tag
 * stripping doesn't fully remove it; this cuts the description before the leak's own signature
 * markers rather than storing garbage into the catalog.
 */
const LEAKED_CHAT_UI_MARKUP = /\bdata-turn-id=|\bdata-testid="conversation-turn|threadScrollVars|\bdata-writing-block\b/i;
function stripTags(value: string): string {
  const withoutTags = decodeHtml(value.replace(/<[^>]+>/g, " "));
  const leakIndex = withoutTags.search(LEAKED_CHAT_UI_MARKUP);
  return (leakIndex === -1 ? withoutTags : withoutTags.slice(0, leakIndex)).trim();
}

const toPrice = (value: string | number | undefined) => {
  const price = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(price) && price > 0 ? price : null;
};
const toAvailability = (value?: string): Availability => (value?.toLowerCase().includes("outofstock") ? "out_of_stock" : value?.toLowerCase().includes("instock") ? "in_stock" : "unknown");
const imageFrom = (image?: string | string[]) => (Array.isArray(image) ? image[0] : image);
const brandName = (brand?: { name?: string } | string) => (typeof brand === "string" ? brand : brand?.name)?.trim();

function extractProductGroup(html: string): JsonLdProductGroup | undefined {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim()) as JsonLdProductGroup;
      if (parsed?.["@type"] === "ProductGroup") return parsed;
    } catch {
      // One malformed JSON-LD block should not invalidate the page.
    }
  }
  return undefined;
}

/**
 * Verified live: Hukut's `additionalProperty` naming differs by category. Phones use a single
 * "Variant" entry with a combined "4/128GB" shorthand; laptops instead use two separate named
 * entries, "RAM" ("16GB") and "SSD" ("512GB") — reading a generic "first GB-looking number" out of
 * either shape is a real bug (it silently reads the RAM figure into `storage` on laptops, which is
 * exactly what a first implementation of this function did before being caught live-testing
 * against real Acer/Lenovo pages). This looks each field up by its own property name instead.
 */
function extractRamStorage(variant: JsonLdVariant): { ram?: string; storage?: string } {
  const byName = (namePattern: RegExp) => variant.additionalProperty?.find((property) => namePattern.test((property.name || "").trim()))?.value;
  const ram = byName(/^ram$/i);
  const storage = byName(/ssd|storage|hdd|emmc/i);
  if (ram || storage) return { ram: ram?.trim(), storage: storage?.trim() };

  const shorthandSource = byName(/^variant$/i) || variant.name || "";
  const shorthand = shorthandSource.match(/(\d+)\s*\/\s*(\d+)\s*gb/i);
  return shorthand ? { ram: `${shorthand[1]}GB`, storage: `${shorthand[2]}GB` } : {};
}

/**
 * Verified live: Hukut's own JSON-LD `brand` field on laptops names the marketing SERIES, not the
 * manufacturer — e.g. `{"name": "Aspire Series"}` for an Acer laptop, `{"name": "Ideapad Series"}`
 * for a Lenovo one, `{"name": "LOQ Gaming Series"}` for another Lenovo one — always ending in the
 * literal word "Series". It's reliable everywhere else (confirmed "Xiaomi" for a Redmi phone, no
 * "Series" suffix there), so this only overrides the JSON-LD brand when it matches that specific
 * "Series"-suffixed pattern, reading the real manufacturer from a known-brand prefix on the
 * product name instead — never a blanket override for every laptop-category product, which would
 * incorrectly clobber a perfectly good brand on any other category reusing this same parser.
 */
const SERIES_NAME_PATTERN = /\bseries$/i;
const KNOWN_LAPTOP_BRAND_PREFIX = /^(lenovo|acer|asus|hp|dell|apple|msi|huawei|honor|infinix|chuwi|microsoft|samsung|lg|gigabyte|razer|realme|xiaomi|toshiba|fujitsu)\b/i;
function resolveBrand(name: string, jsonLdBrand?: string): string | undefined {
  if (jsonLdBrand && !SERIES_NAME_PATTERN.test(jsonLdBrand)) return jsonLdBrand;
  const match = name.match(KNOWN_LAPTOP_BRAND_PREFIX);
  return match ? match[0].toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : jsonLdBrand;
}

const LAPTOP_CATEGORY = /laptop/i;
export const PHONE_CATEGORY = /mobile phone/i;

/**
 * Hukut's `category` field is more granular than our catalog buckets (e.g. "Business Laptops",
 * "Gaming Laptops" rather than just "Laptops") — same reasoning as Mobilemandu's category check
 * (collectors/mobilemandu/parser.ts), a plain string match would miss most real products, so this
 * always takes a RegExp.
 *
 * Every product page uses the ProductGroup/AggregateOffer shape (verified across all 7 sampled
 * categories, including single-variant products) — so unlike Mobilemandu/Evo, a single fetched
 * page fans out into one row per purchasable variant (color × RAM/storage combo), each with its
 * own reliable per-variant `sku` (confirmed live: never reused across Hukut's variants, unlike
 * the free-text SKUs this codebase has learned not to trust on other stores).
 */
export function parseHukutProduct(html: string, productUrl: string, expectedCategory: RegExp): StoreProduct[] {
  const group = extractProductGroup(html);
  if (!group?.hasVariant?.length) throw new Error("missing product JSON-LD or variants");
  const category = (group.category || "").trim();
  if (!expectedCategory.test(category)) throw new Error(`unexpected category (expected ${expectedCategory}, got: ${category || "unknown"})`);

  const groupBrandFallback = brandName(group.brand);
  const image = imageFrom(group.image);
  const description = group.description ? stripTags(group.description) : undefined;

  return group.hasVariant
    .map((variant): StoreProduct | null => {
      const price = toPrice(variant.offers?.price);
      if (!price) return null;
      const { ram, storage } = extractRamStorage(variant);
      const name = variant.name ? decodeHtml(variant.name) : group.name || "";
      return {
        externalId: variant.sku,
        name,
        brand: resolveBrand(name, brandName(variant.brand) || groupBrandFallback),
        color: variant.color,
        storage,
        ram,
        price,
        currency: "NPR" as const,
        imageUrl: image,
        productUrl: variant.offers?.url || productUrl,
        availability: toAvailability(variant.offers?.availability),
        description,
        specifications: { ...(storage ? { Storage: storage } : {}), ...(ram ? { RAM: ram } : {}) },
      };
    })
    .filter((product): product is StoreProduct => product !== null && product.name.length > 0);
}

const LAPTOP_URL_HINT = /(laptop|notebook|macbook|thinkpad|ideapad|vivobook|zenbook|pavilion|inspiron|probook|elitebook|legion|nitro|predator|swift|aspire|chromebook|zbook|omen|victus|\bloq\b|tuf-|rog-)/i;
const LAPTOP_URL_EXCLUDE = /(stand|bag\b|backpack|sleeve|skin\b|cover|case-|charger|power-?bank|adapter|cooling|mat\b|dock\b|hub\b|sticker|decal|screen-guard|mouse\b|keyboard-cover|table\b|desk\b|riser|fan\b|cable|headset|controller)/i;

/**
 * Hukut's `sitemaps/sitemap/products.xml` and `.../pages.xml` share the exact same flat root-path
 * URL shape (verified live) — a slug alone can't tell a product from a blog article, so this must
 * only ever be pointed at `products.xml`, never the sitemap index or `pages.xml`.
 */
export function parseHukutProductUrls(sitemapXml: string, hint: RegExp, exclude: RegExp, limit: number): string[] {
  return [...sitemapXml.matchAll(/<url>\s*<loc>\s*(https:\/\/hukut\.com\/[^<\s]+)\s*<\/loc>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url) => hint.test(url) && !exclude.test(url))
    .slice(0, limit);
}

export const HUKUT_LAPTOP_URL_HINT = LAPTOP_URL_HINT;
export const HUKUT_LAPTOP_URL_EXCLUDE = LAPTOP_URL_EXCLUDE;
export const HUKUT_LAPTOP_CATEGORY = LAPTOP_CATEGORY;
