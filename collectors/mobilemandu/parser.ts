import type { Availability, StoreProduct } from "@/collectors/evo/types";

type JsonLdOffer = { url?: string; priceCurrency?: string; price?: string | number; availability?: string };
type JsonLdProduct = {
  "@type"?: string | string[];
  name?: string;
  sku?: string;
  image?: string | string[];
  description?: string;
  brand?: { name?: string } | string;
  category?: string;
  offers?: JsonLdOffer;
};

// Zero-width/invisible formatting characters (U+200B-U+200F, U+2060-U+2064, U+FEFF) — observed
// embedded inside some (not all) Mobilemandu product descriptions, breaking up ordinary words
// mid-string (e.g. "Apple[ZWSP]'s mo[ZWJ]st po[ZWJ]werful"). Harmless to strip: never appears in
// this site's structured fields (price/sku/category), only in free-text prose.
const stripInvisible = (value: string) => value.replace(/[\u200B-\u200F\u2060-\u2064\uFEFF]/g, "");
const decodeHtml = (value: string) => stripInvisible(value).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
const toPrice = (value: string | number | undefined) => {
  const price = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(price) && price > 0 ? price : null;
};
const toAvailability = (value?: string): Availability => value?.toLowerCase().includes("outofstock") ? "out_of_stock" : value?.toLowerCase().includes("instock") ? "in_stock" : "unknown";
const imageFrom = (image?: string | string[]) => Array.isArray(image) ? image[0] : image;

/** Product names carry an SEO subtitle after a pipe — e.g. "Apple iPhone 16 (128 GB) || Mobile
 * Phones" or "Samsung Galaxy S24 (8/256) |  Immersive viewing and gaming" — only the part before
 * the first "|" is the actual product name. */
const cleanName = (name: string) => decodeHtml(name.split("|")[0]);

function extractJsonLd(html: string): JsonLdProduct[] {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const rows: JsonLdProduct[] = [];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      if (typeof parsed === "object" && parsed !== null && String((parsed as JsonLdProduct)["@type"] || "").includes("Product")) {
        rows.push(parsed as JsonLdProduct);
      }
    } catch {
      // One malformed JSON-LD block should not invalidate the page.
    }
  }
  return rows;
}

/** Best-effort RAM/storage extraction from either the "(8/256)" shorthand in the name or a
 * "8GB RAM 128GB Storage"-style name/slug. Mobilemandu's JSON-LD has no structured
 * additionalProperty list (unlike Evo's), so this is regex-based rather than a clean field read —
 * when it can't confidently extract either, the matcher still works fine on brand+model text
 * alone (§7 of the collectors/core/matcher.ts scoring). */
function extractRamStorage(name: string, slug: string): { ram?: string; storage?: string } {
  const source = `${name} ${slug}`;
  const shorthand = source.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (shorthand) return { ram: `${shorthand[1]}GB`, storage: `${shorthand[2]}GB` };
  const ram = source.match(/(\d+)\s*gb\s*ram/i)?.[1];
  const storage = source.match(/(\d+)\s*gb\s*(?:storage|internal)/i)?.[1] || source.match(/\b(\d+)\s*gb\b(?!\s*ram)/i)?.[1];
  return { ram: ram ? `${ram}GB` : undefined, storage: storage ? `${storage}GB` : undefined };
}

const PHONE_CATEGORY = "mobile phones";
export const LAPTOP_CATEGORY = "laptops";

/**
 * The URL-level filter in parseMobilemanduProductUrls/parseMobilemanduLaptopUrls/etc. is only a
 * rough pre-filter (brand-keyword matching on the slug) — it lets through some wrong-category
 * pages (tablets, earbuds, laptop accessories, and even an unrelated appliance brand that happens
 * to share a name, e.g. a "Vivo" iron). The JSON-LD `category` field is the real signal, so a
 * wrong-category page is rejected here — treated as an expected skip by the collector, not a
 * parse failure (same pattern as Evo's "missing product JSON-LD" for non-product sitemap
 * entries). `expectedCategory` defaults to phones since that's every existing caller.
 *
 * Mobilemandu's `category` field is more granular than our own catalog categories — it's a
 * specific product type ("Speaker", "TV", "Washing Machine"), not a broad bucket like "Audio" or
 * "Home appliances". A plain string only works for an exact type (phones, laptops); anywhere one
 * of our categories maps to several of their types, pass a RegExp instead (e.g. Audio needs to
 * match "Speaker" AND "Wireless Headphone" AND "Wired Headphone").
 */
export function parseMobilemanduProduct(html: string, productUrl: string, expectedCategory: string | RegExp = PHONE_CATEGORY): StoreProduct[] {
  const product = extractJsonLd(html)[0];
  if (!product?.name) throw new Error("missing product JSON-LD or name");
  const category = (product.category || "").trim();
  const matchesCategory = typeof expectedCategory === "string" ? category.toLowerCase() === expectedCategory : expectedCategory.test(category);
  if (!matchesCategory) {
    throw new Error(`unexpected category (expected ${expectedCategory}, got: ${category || "unknown"})`);
  }

  const name = cleanName(product.name);
  const brand = typeof product.brand === "string" ? product.brand : product.brand?.name;
  const slug = new URL(productUrl).pathname;
  const { ram, storage } = extractRamStorage(name, slug);
  const price = toPrice(product.offers?.price);
  if (!price) throw new Error("missing or invalid price");

  return [{
    externalId: product.sku,
    name,
    brand: brand ? decodeHtml(brand) : undefined,
    storage,
    ram,
    price,
    currency: "NPR",
    imageUrl: imageFrom(product.image),
    productUrl: product.offers?.url || productUrl,
    availability: toAvailability(product.offers?.availability),
    description: product.description ? decodeHtml(product.description) : undefined,
    specifications: { ...(storage ? { Storage: storage } : {}), ...(ram ? { RAM: ram } : {}) },
  }];
}

const PHONE_HINT = /(iphone|samsung|galaxy|redmi|xiaomi|oneplus|oppo|realme|vivo(?!book)|poco|honor|nothing|pixel)/i;
const EXCLUDE_HINT = /(buds|earbud|earphone|neckband|bullet|eara-|watch|band(?!width)|charger|powerbank|power-bank|adapter|cable|case-|cover|tempered|glass|protector|tablet|\bpad\b|padx|padgo|pad-|television|smart-tv|-tv-|washing-machine|\biron\b|screen-guard|pouch|\bstrap\b|holder|mount|\bstand\b|backpack|keyboard|mouse|speaker|soundbar|projector|\bpen\b)/i;

/** Loose candidate filter over the products sitemap — see parseMobilemanduProduct's own comment
 * for why the JSON-LD category check, not this regex, is the actual accuracy guarantee. */
export function parseMobilemanduProductUrls(sitemapXml: string, limit = 20): string[] {
  return [...sitemapXml.matchAll(/<loc>\s*(https:\/\/mobilemandu\.com\/products\/[^<\s]+)\s*<\/loc>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url) => PHONE_HINT.test(url) && !EXCLUDE_HINT.test(url))
    .slice(0, limit);
}

const LAPTOP_HINT = /(laptop|notebook|macbook|thinkpad|ideapad|vivobook|zenbook|pavilion|inspiron|probook|elitebook|legion|nitro|predator|swift|aspire|chromebook|zbook|omen|victus)/i;
const LAPTOP_EXCLUDE_HINT = /(stand|bag|backpack|sleeve|skin|cover|case-|charger|power-?bank|adapter|cooling|mat\b|dock|hub|light\b|stickers?|decal|screen-guard|mouse\b|keyboard-cover|table\b|desk\b|riser|fan\b|cable|headset|controller|keyboard(?!-cover)|smart-?watch|bracelet)/i;

/** Same rough-pre-filter role as parseMobilemanduProductUrls, for the Laptops category — see
 * parseMobilemanduProduct's comment for why the JSON-LD category check is the real accuracy
 * guarantee (this list alone still lets through, e.g., a gaming keyboard whose descriptive slug
 * happens to mention "laptop" as a compatibility note). */
export function parseMobilemanduLaptopUrls(sitemapXml: string, limit = 20): string[] {
  return [...sitemapXml.matchAll(/<loc>\s*(https:\/\/mobilemandu\.com\/products\/[^<\s]+)\s*<\/loc>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url) => LAPTOP_HINT.test(url) && !LAPTOP_EXCLUDE_HINT.test(url))
    .slice(0, limit);
}

/**
 * Generic version of the two URL-filter functions above, for the categories added afterward
 * (Audio, TVs, Smartwatches, Home appliances) — same rough-pre-filter role, same reliance on
 * parseMobilemanduProduct's category check for actual accuracy. Kept as a single reusable
 * function here rather than four more near-identical named exports.
 */
export function filterMobilemanduUrls(sitemapXml: string, hint: RegExp, exclude: RegExp | undefined, limit: number): string[] {
  return [...sitemapXml.matchAll(/<loc>\s*(https:\/\/mobilemandu\.com\/products\/[^<\s]+)\s*<\/loc>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url) => hint.test(url) && !(exclude && exclude.test(url)))
    .slice(0, limit);
}

// Verified live against real product pages: Mobilemandu's `category` field names a specific
// product type, not a broad bucket, so each of our catalog categories below maps to a regex
// matching every type string actually seen for it (e.g. Audio: "Speaker", "Wireless Headphone",
// "Wired Headphone") rather than one exact string.
export const AUDIO_CATEGORY = /speaker|headphone|earphone|earbud|soundbar/i;
export const TV_CATEGORY = /^tv$/i;
export const SMARTWATCH_CATEGORY = /smartwatch/i;
export const APPLIANCE_CATEGORY = /refrigerator|washing machine|microwave|air fryer|air condition|vacuum|water purifier|geyser|water heater|induction|rice cooker|dishwasher|freezer/i;

export const AUDIO_URL_HINT = /(speaker|headphone|earphone|earbud|soundbar)/i;
export const AUDIO_URL_EXCLUDE = /(case-|cover|strap|charging-case|adapter\b|cable\b|for-laptop|for-phone|screen-guard)/i;

export const TV_URL_HINT = /(-tv-|\btv\b|television|smart-led-tv|uhd-tv|qled|oled-tv)/i;
export const TV_URL_EXCLUDE = /(tv-box|tv-stand|tv-mount|tv-stick|apple-tv|remote|antenna|tv-cable|wall-mount|bracket)/i;

export const SMARTWATCH_URL_HINT = /smart-?watch/i;
export const SMARTWATCH_URL_EXCLUDE = /(strap|\bband\b|charger|screen-guard|glass|case-|cover|dock\b)/i;

export const APPLIANCE_URL_HINT = /(washing-machine|refrigerator|\bfridge\b|microwave|air-fryer|air-condition|vacuum-cleaner|water-purifier|\bgeyser\b|water-heater|induction|rice-cooker|dishwasher|\bfreezer\b)/i;
export const APPLIANCE_URL_EXCLUDE = /(cover|bag\b|filter-only|spare-part)/i;
