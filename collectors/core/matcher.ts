import { createHash } from "node:crypto";
import type { StoreProduct } from "@/collectors/evo/types";

export type NormalizedAttributes = {
  brand: string;
  model: string;
  storage?: string;
  ram?: string;
  color?: string;
};

export type MatchCandidate = {
  id: string;
  name: string;
  brand: string;
  specifications?: Record<string, unknown> | null;
};

export type MatchResult = {
  candidate: MatchCandidate | null;
  confidence: number;
  reasons: string[];
};

const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const knownBrands = ["apple", "samsung", "google", "xiaomi", "oneplus", "honor", "nothing", "sony", "dell", "lenovo", "asus", "hp", "acer"];
const first = (value?: string) => value?.trim() || undefined;

export function normalizeStoreProduct(product: StoreProduct): NormalizedAttributes {
  const source = clean([product.brand, product.model, product.name, product.storage, product.ram, product.color].filter(Boolean).join(" "));
  const brand = clean(product.brand || knownBrands.find((item) => source.includes(item)) || "unknown");
  const storage = first(product.storage) || source.match(/\b(\d+(?:\.\d+)?)\s*(gb|tb)\b/i)?.[0];
  const ram = first(product.ram) || source.match(/\b(\d+(?:\.\d+)?)\s*gb\s*ram\b/i)?.[0];
  const color = first(product.color);
  const withoutBrand = source.replace(new RegExp(`\\b${brand}\\b`, "g"), "");
  const model = clean(product.model || withoutBrand.replace(/\b\d+(?:\.\d+)?\s*(gb|tb)\b/gi, "").replace(/\bram\b/gi, ""));
  return { brand, model, storage: storage && clean(storage).replace(/\s+/g, ""), ram: ram && clean(ram).replace(/\s+/g, ""), color: color && clean(color) };
}

export function scoreMatch(source: NormalizedAttributes, candidate: NormalizedAttributes): MatchResult {
  let confidence = 0;
  const reasons: string[] = [];
  if (source.brand !== "unknown" && source.brand === candidate.brand) { confidence += 20; reasons.push("brand"); }
  if (source.model && source.model === candidate.model) { confidence += 40; reasons.push("model"); }
  if (source.storage && candidate.storage && source.storage === candidate.storage) { confidence += 25; reasons.push("storage"); }
  if (source.ram && candidate.ram && source.ram === candidate.ram) { confidence += 10; reasons.push("ram"); }
  if (source.color && candidate.color && source.color === candidate.color) { confidence += 5; reasons.push("color"); }
  return { candidate: null, confidence, reasons };
}

export function findBestMatch(sourceProduct: StoreProduct, candidates: MatchCandidate[]): MatchResult {
  const source = normalizeStoreProduct(sourceProduct);
  const ranked = candidates.map((candidate) => {
    const result = scoreMatch(source, normalizeStoreProduct({ name: candidate.name, brand: candidate.brand, price: 1, currency: "NPR", productUrl: "", specifications: Object.fromEntries(Object.entries(candidate.specifications || {}).map(([key, value]) => [key, String(value)])) }));
    return { ...result, candidate };
  }).sort((first, second) => second.confidence - first.confidence);
  return ranked[0] || { candidate: null, confidence: 0, reasons: [] };
}

export function productSlug(product: StoreProduct) {
  return clean([product.brand, product.name, product.storage].filter(Boolean).join(" ")).replace(/\s+/g, "-").slice(0, 100);
}

/**
 * §slug-collision (found while adding a second Evo category): the previous approach — truncating
 * the sanitized externalId to its first 24 characters — silently collided whenever two distinct
 * externalIds shared a long common prefix (e.g. two URL-derived ids both starting
 * "macbook-air-13-inch-m5-16gb-..." before diverging past character 24), causing a real
 * `products_slug_key` unique-constraint failure that dropped the second product entirely. A
 * short hash of the *whole* externalId can't collide that way regardless of how long a common
 * prefix/suffix two ids share.
 */
export function externalIdSlugSuffix(externalId: string | null | undefined): string {
  if (!externalId) return String(Date.now());
  return createHash("sha1").update(externalId).digest("hex").slice(0, 10);
}
