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

/**
 * The URL-level filter in parseMobilemanduProductUrls is only a rough pre-filter (brand-keyword
 * matching on the slug) — it lets through some non-phones (tablets, earbuds, and even an
 * unrelated appliance brand that happens to share a name, e.g. a "Vivo" iron). The JSON-LD
 * `category` field is the real signal, so a wrong-category page is rejected here — treated as an
 * expected skip by the collector, not a parse failure (same pattern as Evo's "missing product
 * JSON-LD" for non-product sitemap entries).
 */
export function parseMobilemanduProduct(html: string, productUrl: string): StoreProduct[] {
  const product = extractJsonLd(html)[0];
  if (!product?.name) throw new Error("missing product JSON-LD or name");
  if ((product.category || "").trim().toLowerCase() !== PHONE_CATEGORY) {
    throw new Error(`not a phone product (category: ${product.category || "unknown"})`);
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
