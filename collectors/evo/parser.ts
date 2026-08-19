import type { Availability, StoreProduct } from "@/collectors/evo/types";

type JsonLdOffer = {
  sku?: string;
  price?: string | number;
  priceCurrency?: string;
  url?: string;
  availability?: string;
  additionalProperty?: { name?: string; value?: string };
};

type JsonLdProduct = {
  "@type"?: string | string[];
  name?: string;
  sku?: string;
  image?: string | string[];
  description?: string;
  brand?: { name?: string } | string;
  additionalProperty?: { name?: string; value?: string }[];
  offers?: { offers?: JsonLdOffer[]; price?: string | number; priceCurrency?: string; availability?: string; url?: string; sku?: string; additionalProperty?: { name?: string; value?: string } } | JsonLdOffer[];
};

const decodeHtml = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
const toPrice = (value: string | number | undefined) => {
  const price = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(price) && price > 0 ? price : null;
};
const toAvailability = (value?: string): Availability => value?.toLowerCase().includes("outofstock") ? "out_of_stock" : value?.toLowerCase().includes("instock") ? "in_stock" : "unknown";
const imageFrom = (image?: string | string[]) => Array.isArray(image) ? image[0] : image;
const propertyMap = (properties: { name?: string; value?: string }[] = []) => Object.fromEntries(properties.filter((property) => property.name && property.value).map((property) => [property.name!, property.value!]));

function extractJsonLd(html: string): JsonLdProduct[] {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const rows: JsonLdProduct[] = [];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      const values = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null && "@graph" in parsed && Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
      rows.push(...values.filter((value): value is JsonLdProduct => typeof value === "object" && value !== null && String((value as JsonLdProduct)["@type"] || "").includes("Product")));
    } catch {
      // One malformed JSON-LD block should not invalidate the page.
    }
  }
  return rows;
}

export function parseProductPage(html: string, productUrl: string): StoreProduct[] {
  const product = extractJsonLd(html)[0];
  if (!product?.name) throw new Error("missing product JSON-LD or name");
  const brand = typeof product.brand === "string" ? product.brand : product.brand?.name;
  const base = { name: decodeHtml(product.name), brand: brand ? decodeHtml(brand) : undefined, imageUrl: imageFrom(product.image), productUrl, description: product.description, specifications: propertyMap(product.additionalProperty) };
  const offers: JsonLdOffer[] = Array.isArray(product.offers) ? product.offers : product.offers?.offers ? product.offers.offers : product.offers ? [product.offers] : [];
  const normalized = (offers || []).flatMap((offer) => { const price = toPrice(offer?.price); if (!price) return []; const variant = offer?.additionalProperty?.value; return [{ ...base, name: variant ? `${base.name} ${variant}` : base.name, externalId: offer?.sku || product.sku, price, currency: "NPR" as const, productUrl: offer?.url || productUrl, availability: toAvailability(offer?.availability) }]; });
  if (normalized.length) return normalized;
  const price = toPrice(product.offers && !Array.isArray(product.offers) ? product.offers.price : undefined);
  return price ? [{ ...base, externalId: product.sku, price, currency: "NPR", productUrl, availability: toAvailability(product.offers && !Array.isArray(product.offers) ? product.offers.availability : undefined) }] : [];
}

export function parseProductUrls(sitemap: string, limit = 20): string[] {
  return [...sitemap.matchAll(/<loc>\s*(https:\/\/evostore\.com\.np\/[^<\s]+)\s*<\/loc>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url) => /iphone|samsung[-_]|galaxy|pixel|oneplus|xiaomi|redmi|honor|nothing[-_]/i.test(url))
    .filter((url) => !/case|charger|adapter|tempered|glass|cable|cover|protector|power-bank|airtag|watch|buds|earphone|wallet|microphone|series$/i.test(url))
    .filter((url) => !/\/(apple-iphone|iphone-air|iphone13-iphone15)$/i.test(url))
    .slice(0, limit);
}
