import type { Availability, StoreProduct } from "@/collectors/evo/types";

type JsonLdOffer = { price?: string | number; priceCurrency?: string; availability?: string };
type JsonLdProduct = { "@type"?: string; name?: string; image?: string | string[]; brand?: { name?: string }; offers?: JsonLdOffer | JsonLdOffer[] };
type JsonLdGraph = { "@graph"?: JsonLdProduct[] };

const decodeHtml = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
const toAvailability = (value?: string): Availability => (value?.toLowerCase().includes("outofstock") ? "out_of_stock" : value?.toLowerCase().includes("instock") ? "in_stock" : "unknown");

/**
 * This site's JSON-LD ships a `Product` entry nested inside a `@graph` array alongside unrelated
 * WebSite/Organization/LocalBusiness/FAQPage blocks (each its own separate `<script>` tag, plus
 * one shared `@graph` array) — the Product must be found by type, not assumed to be the first or
 * only JSON-LD block on the page.
 */
function extractJsonLdProduct(html: string): JsonLdProduct | undefined {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim()) as JsonLdProduct | JsonLdGraph;
      if ("@graph" in parsed && parsed["@graph"]) {
        const product = parsed["@graph"].find((item) => item["@type"] === "Product");
        if (product) return product;
      } else if ((parsed as JsonLdProduct)["@type"] === "Product") {
        return parsed as JsonLdProduct;
      }
    } catch {
      // One malformed JSON-LD block should not invalidate the page.
    }
  }
  return undefined;
}

/**
 * Neither `sku` nor `mpn` in JSON-LD is ever populated on this site (verified live, blank on
 * every product) — the real numeric id only exists in a hidden form input on the page,
 * `<input type="hidden" name="product_id" value="187">`, confirmed distinct and non-reused across
 * every product sampled. Not WooCommerce (no Store API exists here at all) — this is a custom
 * Laravel storefront, so category listings and product details both come from scraping HTML/
 * JSON-LD directly, the same class of approach as collectors/neostore/parser.ts.
 */
function extractProductId(html: string): string | undefined {
  return html.match(/name="product_id"\s+value="(\d+)"/)?.[1];
}

export function parseExortstoreProduct(html: string, productUrl: string): StoreProduct[] {
  const product = extractJsonLdProduct(html);
  if (!product?.name) throw new Error("missing product JSON-LD or name");
  const externalId = extractProductId(html);
  if (!externalId) throw new Error("missing product_id hidden field");

  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  const price = Number(offer?.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("missing or invalid price");

  const image = Array.isArray(product.image) ? product.image[0] : product.image;
  // Verified live: brand.name carries stray leading/trailing spaces (" BoAt ", " Alewa ") on
  // every product sampled — trimmed here rather than stored as-is.
  const brand = product.brand?.name?.trim();

  return [{
    externalId,
    name: decodeHtml(product.name),
    brand: brand || undefined,
    price,
    currency: "NPR",
    imageUrl: image,
    productUrl,
    availability: toAvailability(offer?.availability),
  }];
}

/**
 * Verified live: this site skews heavily toward PC components/gadgets (1,872 products site-wide
 * per its sitemap), but "Smart Watch" (/category/smart-watch) has 14 genuinely real, distinct
 * products (Alewa, Amazfit, Asta Wolf, BoAt, Kieselect/Kieslect, Moon) — the best real category
 * found of the three checked (Security Cameras and Drones were both confirmed thin, 2-3 items).
 * The category listing page has no pagination controls for this category — its own
 * "Showing X-Y of Z results" text confirms 14 is the true total, not page 1 of many.
 */
export function parseExortstoreProductUrls(categoryPageHtml: string, limit: number): string[] {
  return [...new Set([...categoryPageHtml.matchAll(/href="(https:\/\/exortstore\.com\/product\/[^"]+)"/g)].map((match) => match[1]))].slice(0, limit);
}

export const EXORTSTORE_SMARTWATCH_CATEGORY_URL = "https://exortstore.com/category/smart-watch";
