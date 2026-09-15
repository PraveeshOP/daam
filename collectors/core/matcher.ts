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
  // §RAM-mislabeled-as-storage (found live importing DealAyo): names conventionally read
  // "12GB RAM 512GB Storage" — a plain `/\b\d+\s*(gb|tb)\b/` fallback (no lookahead) matches the
  // FIRST such figure, which is the RAM one, not the storage one. Two real, distinctly-priced
  // variants that share the same RAM but differ only in storage (e.g. Vivo V60 5G 12GB/512GB vs
  // 12GB/256GB) then normalize to an *identical* (wrong) "storage" value, silently scoring as the
  // same product at ≥75% confidence and overwriting one variant's offer with the other's price —
  // a real, live data-loss bug, not a theoretical one. The negative lookahead skips any GB/TB
  // figure immediately followed by "ram", so the fallback finds the real storage figure
  // regardless of whether RAM or storage is written first in the name.
  const storage = first(product.storage) || source.match(/\b(\d+(?:\.\d+)?)\s*(gb|tb)\b(?!\s*ram)/i)?.[0];
  const ram = first(product.ram) || source.match(/\b(\d+(?:\.\d+)?)\s*gb\s*ram\b/i)?.[0];
  const color = first(product.color);
  const withoutBrand = source.replace(new RegExp(`\\b${brand}\\b`, "g"), "");
  const model = clean(product.model || withoutBrand.replace(/\b\d+(?:\.\d+)?\s*(gb|tb)\b/gi, "").replace(/\bram\b/gi, ""));
  return { brand, model, storage: storage && clean(storage).replace(/\s+/g, ""), ram: ram && clean(ram).replace(/\s+/g, ""), color: color && clean(color) };
}

/**
 * Marketing filler that appears in retail product names but carries no identity. Stripped before
 * two models are compared so a terse name can still match a verbose one describing the same
 * thing — "s26 ultra" vs "galaxy s26 ultra 5g with 200mp camera and privacy display".
 *
 * Deliberately excludes anything that distinguishes variants: no sizes, no chip names, no
 * capacities, and none of the VARIANT words below.
 */
const MODEL_NOISE = new Set([
  "with", "and", "the", "for", "new", "official", "genuine", "warranty", "brand", "box", "sealed",
  "5g", "4g", "lte", "wifi", "bluetooth", "dual", "sim", "camera", "display", "screen", "privacy",
  "smartphone", "phone", "mobile", "handset", "laptop", "notebook", "inch", "model", "series",
  "edition", "version", "colour", "color", "price", "nepal", "specs",
]);

/**
 * Words that change *which* product this is. If one side carries one and the other does not, the
 * two are different variants no matter how much else they share — "iPhone 17" and "iPhone 17 Pro"
 * overlap almost completely and must never merge.
 */
const MODEL_VARIANTS = new Set(["pro", "max", "plus", "ultra", "air", "mini", "lite", "se", "fe", "neo", "prime", "max+"]);

const modelTokens = (model: string) => model.split(" ").filter((token) => token && !MODEL_NOISE.has(token));

/**
 * Model similarity, 0-40.
 *
 * Replaces a bare `source.model === candidate.model`, which was exact string equality and so
 * awarded nothing unless two names matched character for character. Retail catalogue names are
 * verbose marketing strings, so in practice the 40 points almost never landed: a *correct* pair
 * topped out at brand (20) + storage (25) = 65, under the 75 auto-merge bar, while a bare storage
 * coincidence still scored 25. That is why the review queue holds 403 candidates stuck at 55-70%,
 * why the catalogue carries 28 near-duplicate MacBook rows, and why a SanDisk 128GB flash drive
 * ranked against "iPhone 16 128 GB".
 *
 * Loosening this is only safe because the three gates below refuse outright rather than scale:
 *
 *  1. **Variant words must agree exactly.** "iphone 17" vs "iphone 17 pro" -> 0.
 *  2. **Numeric discriminators must not conflict.** Every number on the shorter side must appear
 *     on the longer one, so "iphone 17" vs "iphone 16" -> 0, and "m5 24" vs "m5 14" -> 0.
 *  3. **High containment required.** After noise removal, the shorter token set must be almost
 *     entirely contained in the longer one; below 0.8 scores 0 rather than a little.
 *
 * Only then is credit awarded, scaled by containment (32-40). Partial credit never invents a
 * match on its own — 40 + storage 25 = 65 still needs a brand agreement to reach 75.
 */
export function scoreModelSimilarity(sourceModel?: string, candidateModel?: string): number {
  if (!sourceModel || !candidateModel) return 0;
  if (sourceModel === candidateModel) return 40;

  const sourceTokens = modelTokens(sourceModel);
  const candidateTokens = modelTokens(candidateModel);
  const sourceSet = new Set(sourceTokens);
  const candidateSet = new Set(candidateTokens);
  if (!sourceSet.size || !candidateSet.size) return 0;

  /*
   * Counted, not just present. "MacBook Pro M5" and "MacBook Pro M5 Pro" are different machines
   * (M5 vs M5 Pro chip), but a Set collapses the candidate's two "pro" tokens into one and the
   * distinction disappears — which really did produce an 85% match between a plain-M5 listing and
   * an M5 Pro catalogue row. Comparing multiplicities keeps chip/product tiers apart.
   */
  const variantsOf = (tokens: string[]) => tokens.filter((token) => MODEL_VARIANTS.has(token)).sort().join(" ");
  if (variantsOf(sourceTokens) !== variantsOf(candidateTokens)) return 0;

  const numbersOf = (set: Set<string>) => new Set([...set].filter((token) => /\d/.test(token)));
  const sourceNumbers = numbersOf(sourceSet);
  const candidateNumbers = numbersOf(candidateSet);
  const [fewer, more] = sourceNumbers.size <= candidateNumbers.size ? [sourceNumbers, candidateNumbers] : [candidateNumbers, sourceNumbers];
  for (const number of fewer) if (!more.has(number)) return 0;

  const overlap = [...sourceSet].filter((token) => candidateSet.has(token)).length;
  const containment = overlap / Math.min(sourceSet.size, candidateSet.size);
  if (containment < 0.8) return 0;
  return Math.round(40 * containment);
}

export function scoreMatch(source: NormalizedAttributes, candidate: NormalizedAttributes): MatchResult {
  let confidence = 0;
  const reasons: string[] = [];
  if (source.brand !== "unknown" && source.brand === candidate.brand) { confidence += 20; reasons.push("brand"); }
  const modelScore = scoreModelSimilarity(source.model, candidate.model);
  if (modelScore) { confidence += modelScore; reasons.push(modelScore === 40 ? "model" : `model~${modelScore}`); }
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
