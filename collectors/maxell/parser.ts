import type { Availability, StoreProduct } from "@/collectors/evo/types";
import { extractLaptopRamStorage } from "@/collectors/core/specs";

type JsonLdOffer = { price?: number | string; priceCurrency?: string; availability?: string; url?: string };
type JsonLdProduct = { "@type"?: string; name?: string; category?: string; brand?: { name?: string } | string; image?: string | string[]; offers?: JsonLdOffer };

const decodeHtml = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
const toAvailability = (value?: string): Availability => (value?.toLowerCase().includes("outofstock") ? "out_of_stock" : value?.toLowerCase().includes("instock") ? "in_stock" : "unknown");
const brandName = (brand?: { name?: string } | string) => (typeof brand === "string" ? brand : brand?.name)?.trim();

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
 * This site's public API (`api.maxell.com.np/api/v1/products`) was retired (verified live:
 * `410 Gone`, deliberate, not just missing) — this scrapes JSON-LD from each product page
 * instead. `sku` formats are wildly inconsistent across the catalog (verified live: some
 * "PRD-LENOVO-IDE-EJIA", some "LEN-000691", some long descriptive strings) — never trusted, per
 * this codebase's rule. The real numeric id only exists inside the page's Next.js RSC stream
 * (`self.__next_f.push(...)`, HTML-entity/backslash-escaped), which is a much more fragile parse
 * (the same class of complexity avoided on collectors/neostore/parser.ts and
 * collectors/zolpastore/parser.ts) — so this uses the URL slug as the stable external id instead,
 * this codebase's established fallback when a site has no reliable id of its own.
 */
export function parseMaxellProduct(html: string, productUrl: string, expectedCategory: RegExp): StoreProduct[] {
  const product = extractJsonLdProduct(html);
  if (!product?.name) throw new Error("missing product JSON-LD or name");
  const category = (product.category || "").trim();
  if (!expectedCategory.test(category)) throw new Error(`unexpected category (expected ${expectedCategory}, got: ${category || "unknown"})`);

  const price = Number(product.offers?.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("missing or invalid price");
  const name = decodeHtml(product.name);
  const { ram, storage } = extractLaptopRamStorage(name);
  const externalId = new URL(productUrl).pathname.replace(/^\/product\//, "").replace(/\/$/, "");

  return [{
    externalId,
    name,
    brand: brandName(product.brand),
    ram,
    storage,
    price,
    currency: "NPR",
    // No imageUrl: verified live that api.maxell.com.np's image CDN has hotlink protection
    // requiring a Referer matching maxell.com.np's own domain — even a direct fetch from our own
    // app's origin gets a 403, not just next/image's server-side proxy. Working around that would
    // mean spoofing a Referer header to impersonate their own site, which is circumventing an
    // explicit anti-embedding protection, not evading a bot-blocking WAF — so this collector
    // simply doesn't populate an image for Maxell products rather than serving a broken one.
    productUrl: product.offers?.url || productUrl,
    availability: toAvailability(product.offers?.availability),
  }];
}

const LAPTOP_URL_HINT = /(laptop|notebook|macbook|thinkpad|ideapad|vivobook|zenbook|pavilion|inspiron|probook|elitebook|legion|nitro|predator|swift|aspire|chromebook|zbook|omen|victus|\bloq\b|tuf-|rog-)/i;
const LAPTOP_URL_EXCLUDE = /(stand|bag\b|backpack|sleeve|skin\b|cover|case-|charger|power-?bank|adapter|cooling|mat\b|dock\b|hub\b|sticker|decal|screen-guard|mouse\b|keyboard-cover|table\b|desk\b|riser|fan\b|cable|headset|controller)/i;

export function parseMaxellProductUrls(sitemapXml: string, limit: number): string[] {
  return [...sitemapXml.matchAll(/<loc>\s*(https:\/\/maxell\.com\.np\/product\/[^<\s]+)\s*<\/loc>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url) => LAPTOP_URL_HINT.test(url) && !LAPTOP_URL_EXCLUDE.test(url))
    .slice(0, limit);
}

export const MAXELL_LAPTOP_CATEGORY = /laptop/i;
