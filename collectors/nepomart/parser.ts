import type { StoreProduct } from "@/collectors/evo/types";

const decodeHtml = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();

/**
 * This site's JSON-LD `name` is always prefixed with the same fixed site tagline before the real
 * product name — but verified live the separator between them is inconsistent: some products use
 * "||" (e.g. "...Best Online Gadget Store in Nepal || T800 Smart iWatch Ultra"), others use a
 * single "|" (e.g. "...Best Online Gadget Store in Nepal | M10 Wireless TWS Bluetooth Earbuds").
 * Splitting on "||" alone left the tagline attached to every single-"|" product's name — this
 * strips the fixed tagline text directly instead, tolerant of either separator.
 */
const cleanName = (name: string) => decodeHtml(name.replace(/^NEPOmart.*?Best Online Gadget Store in Nepal\s*\|+\s*/i, ""));

/**
 * Verified live: JSON-LD `brand.name` is a hardcoded literal `"0"` on every product on this site
 * (a confirmed platform bug, not a real brand — even present on a genuine boAt-branded item) — so
 * this is never read, brand is guessed from the name instead. Most of this site's smartwatch
 * catalog is generic Chinese clone models (T800/T900/S8 Ultra/X7) with no real manufacturer at
 * all, so leaving brand undefined for those is the honest outcome, not a bug.
 */
const KNOWN_BRAND_PREFIX = /^(boat|noise|fireboltt|fire-boltt|amazfit|zeblaze|samsung|xiaomi|realme|oneplus|honor|huawei|jbl|oraimo)/i;
function guessBrand(name: string): string | undefined {
  const match = name.match(KNOWN_BRAND_PREFIX);
  return match ? match[0].toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined;
}

/**
 * Never key on `sku` — verified live it's a sequential-looking "NPM-NNN" string, but per this
 * codebase's rule of never trusting a free-text sku blindly, the real numeric id embedded in the
 * page's own `Object.defineProperty(window, '_BROTERMID', {value: N, ...})` script is used
 * instead — confirmed unique across every product sampled.
 */
function extractBrotermId(html: string): string | undefined {
  return html.match(/_BROTERMID['"]?\s*,\s*\{\s*value:\s*(\d+)/)?.[1];
}

/**
 * No JSON-LD `offers`/price field exists on this site at all (verified live) — the real price is
 * a hidden form input, `brodox-product-hidden-display-price`, which gives a clean plain number
 * with no currency formatting to strip (unlike the visible "Rs 699.00" text span).
 */
function extractPrice(html: string): number | null {
  const price = Number(html.match(/value="(\d+(?:\.\d+)?)"\s*brodox-target="brodox-product-hidden-display-price"/)?.[1]);
  return Number.isFinite(price) && price > 0 ? price : null;
}

type JsonLdProduct = { "@type"?: string; name?: string; image?: string | string[] };

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
 * No stock-status signal on this site is trustworthy from static HTML alone — verified live the
 * page always server-renders an "Out Of Stock" block with `style="display:none"` (with a
 * commented-out "in-stock" sibling), meaning real availability is toggled client-side, not
 * something a plain fetch can read. Same honest fallback as collectors/mystore/parser.ts:
 * availability is "unknown" here rather than guessed from an unreliable static marker.
 */
export function parseNepomartProduct(html: string, productUrl: string): StoreProduct[] {
  const product = extractJsonLdProduct(html);
  if (!product?.name) throw new Error("missing product JSON-LD or name");
  const price = extractPrice(html);
  if (!price) throw new Error("missing or invalid price");
  const externalId = extractBrotermId(html);
  if (!externalId) throw new Error("missing _BROTERMID product id");

  const name = cleanName(product.name);
  const image = Array.isArray(product.image) ? product.image[0] : product.image;

  return [{
    externalId,
    name,
    brand: guessBrand(name),
    price,
    currency: "NPR",
    imageUrl: image,
    productUrl,
    availability: "unknown",
  }];
}

/**
 * Verified live: category browsing pages on this site are badly under-populated (16-item cap on
 * "Audio Devices", no pagination found) relative to real inventory, and there's no working site
 * search — the sitemap plus a keyword filter is the only reliable discovery path. False positives
 * confirmed live and excluded: analog "wrist watch" lighters, watch-box/couple's-watch listings,
 * a USB-C adapter and carrying cases surfacing under the earbuds keyword.
 */
const SMARTWATCH_URL_HINT = /smart[-\s]?(?:i)?watch|\bt800\b|\bt900\b|\bs8[-\s]?ultra\b/i;
const EARBUDS_URL_HINT = /earbud|earphone|tws\b|wireless-headphone/i;
const URL_EXCLUDE = /wrist-watch|analog|watch-box|couple|lighter|carrying-case|usb-c-adapter|bag-with-hook/i;

export function parseNepomartProductUrls(sitemapXml: string, limit: number): string[] {
  return [...sitemapXml.matchAll(/<loc>\s*(https:\/\/www\.nepomart\.com\/product\/[^<\s]+)\s*<\/loc>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url) => (SMARTWATCH_URL_HINT.test(url) || EARBUDS_URL_HINT.test(url)) && !URL_EXCLUDE.test(url))
    .filter((url, index, all) => all.indexOf(url) === index) // the raw sitemap has ~32 exact-duplicate URLs, verified live
    .slice(0, limit);
}
