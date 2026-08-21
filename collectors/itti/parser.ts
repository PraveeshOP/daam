import type { StoreProduct } from "@/collectors/evo/types";

export type IttiPayload = {
  pid: number;
  sku: string;
  name: string;
  short_name?: string;
  description?: string;
  summary?: string;
  specification?: string;
  price?: { sku?: string; stock?: number; in_stock?: boolean; selling_price?: number; mark_price?: number };
  image?: { image?: string };
  /** e.g. "https://itti.com.np/laptops-by-brands/lenovo-laptops-nepal/thinkpad" — ITTI has no
   * single flat "category" field like Mobilemandu's JSON-LD, but this breadcrumb-style URL is
   * the same kind of ground-truth signal the laptops collector needs (see its own comment). */
  canonical_url?: string;
};

const stripHtml = (value = "") => value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const specificationValue = (html: string, label: string) => {
  const match = html.match(new RegExp(`<td[^>]*>${label}<\\/td>\\s*<td[^>]*>([^<]+)`, "i"));
  return match?.[1]?.trim();
};
const firstImage = (url?: string) => url?.replace(/\\/g, "");

export function parseIttiProduct(payload: { is_product?: boolean; data?: IttiPayload }, productUrl: string): StoreProduct[] {
  const item = payload.is_product ? payload.data : undefined;
  if (!item?.name) throw new Error("missing ITTI product payload or name");
  const storage = item.sku.match(/\b(\d+(?:GB|TB))\b/i)?.[1] || specificationValue(item.specification || "", "Internal Storage");
  const ram = specificationValue(item.specification || "", "RAM");
  const model = specificationValue(item.specification || "", "Model") || item.short_name || item.name;
  const brand = specificationValue(item.specification || "", "Brand") || item.name.split(" ")[0];
  const imageUrl = firstImage(item.image?.image);
  const price = Number(item.price?.selling_price ?? item.price?.mark_price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("missing or invalid ITTI price");
  return [{ externalId: item.sku || String(item.pid), name: `${item.name}${storage && !item.name.toLowerCase().includes(storage.toLowerCase()) ? ` ${storage}` : ""}`, brand, model, storage, ram, price, currency: "NPR", imageUrl, productUrl, availability: item.price?.in_stock ? "in_stock" : "out_of_stock", description: stripHtml(item.description || item.summary), specifications: { Model: model, ...(storage ? { Storage: storage } : {}), ...(ram ? { RAM: ram } : {}) } }];
}

export function parseIttiProductUrls(sitemap: string, limit = 20) {
  const urls = [...sitemap.matchAll(/<loc>\s*(https:\/\/itti\.com\.np\/product\/[^<\s]+)\s*<\/loc>/gi)]
    .map((match) => match[1])
    .filter((url) => /iphone|samsung-galaxy|oneplus|xiaomi|redmi|pixel|honor/i.test(url))
    .filter((url) => !/case|cover|charger|adapter|cable|watch|buds|earphone|accessor|tab/i.test(url));
  return urls.sort((first, second) => {
    const priority = (url: string) => /apple-iphone-(15|16|17)/i.test(url) ? 3 : /samsung-galaxy-(a|s)/i.test(url) ? 2 : /oneplus|xiaomi|redmi|pixel|honor/i.test(url) ? 1 : 0;
    return priority(second) - priority(first);
  }).slice(0, limit);
}

const LAPTOP_URL_HINT = /(laptop|notebook|macbook|thinkpad|ideapad|vivobook|zenbook|pavilion|inspiron|probook|elitebook|legion|nitro|predator|swift-|aspire|chromebook|zbook|omen|victus)/i;
const LAPTOP_URL_EXCLUDE = /(monitor|display\b|-tv-|television|case-|cover|charger|adapter|cable|backpack|bagpack|\bbag\b|sleeve|skin|mouse\b|keyboard(?!-)|headset|earphone|earbud|speaker|webcam|dock|\bstand\b|mat\b|cooling|hub\b|-pad\b|screen-guard|screen-extender|gaming-desktop|gaming-chair|\bcasing\b|all-in-one|\baio\b|-ram-|-memory-|sodimm)/i;

/** Same rough-pre-filter role as parseIttiProductUrls, for the Laptops category — desktops,
 * monitors, RAM modules, and even a gaming chair/backpack share enough vocabulary with real
 * laptop model names to need excluding here; parseIttiLaptopProduct's canonical_url check below
 * is the actual accuracy guarantee, same division of labor as parseIttiProductUrls/
 * parseIttiProduct. */
export function parseIttiLaptopUrls(sitemap: string, limit = 20) {
  return [...sitemap.matchAll(/<loc>\s*(https:\/\/itti\.com\.np\/product\/[^<\s]+)\s*<\/loc>/gi)]
    .map((match) => match[1])
    .filter((url) => LAPTOP_URL_HINT.test(url) && !LAPTOP_URL_EXCLUDE.test(url))
    .slice(0, limit);
}

/**
 * ITTI has no single flat "category" field the way Mobilemandu's JSON-LD does — `canonical_url`
 * (a breadcrumb-style path like "/laptops-by-brands/...") is the closest equivalent ground truth,
 * so it's checked here rather than trusting the URL-level filter above. Also overrides
 * `externalId` to ITTI's internal numeric `pid` rather than the free-text `sku` field
 * `parseIttiProduct` uses for phones: verified live that ITTI's laptop `sku` values (e.g. "Lenovo
 * Thinkpad X13 intel") don't always encode enough of the configuration to stay unique across
 * variants — the exact class of bug already found and fixed for Evo's MacBooks — so `pid` (an
 * internal auto-increment id) is the safer choice for this category rather than repeating it.
 */
export function parseIttiLaptopProduct(payload: { is_product?: boolean; data?: IttiPayload }, productUrl: string): StoreProduct[] {
  const [product] = parseIttiProduct(payload, productUrl);
  const canonicalUrl = payload.data?.canonical_url || "";
  if (!/\blaptop/i.test(canonicalUrl)) throw new Error(`unexpected category (canonical_url: ${canonicalUrl || "unknown"})`);
  return [{ ...product, externalId: String(payload.data!.pid) }];
}

const GAMING_URL_HINT = /(playstation|\bxbox\b|nintendo-switch|\bps5\b|\bps4\b|legion-go|rog-ally|rog-xbox)/i;
const GAMING_URL_EXCLUDE = /(kvm-switch|sharing-switch|switch-selector|case-|cover|controller-skin|charging-dock|headset|controller\b)/i;

/** Same rough-pre-filter role as parseIttiLaptopUrls, for gaming consoles — "switch" alone would
 * false-positive on KVM/USB-sharing switches (unrelated networking accessories that happen to
 * use the same word), so the hint requires "nintendo-switch" specifically rather than a bare
 * "switch". */
export function parseIttiGamingUrls(sitemap: string, limit = 20) {
  return [...sitemap.matchAll(/<loc>\s*(https:\/\/itti\.com\.np\/product\/[^<\s]+)\s*<\/loc>/gi)]
    .map((match) => match[1])
    .filter((url) => GAMING_URL_HINT.test(url) && !GAMING_URL_EXCLUDE.test(url))
    .slice(0, limit);
}

/**
 * Generic version of parseIttiLaptopProduct's canonical_url-check + pid-override logic, for
 * categories added afterward (gaming consoles) — same reasoning: canonical_url is the ground
 * truth ITTI actually provides, and pid is safer than trusting sku's uniqueness for a new
 * category without first-hand evidence either way.
 *
 * `nameFallbackHint` exists because canonical_url turned out to be missing entirely (falls back
 * to the bare product URL, no real breadcrumb) for several real, unambiguous consoles — verified
 * live for the PS5 Pro, PS5 Slim, and ROG Xbox Ally listings. Rather than rejecting those simply
 * because ITTI's own breadcrumb data has a gap, a strong product-name match is accepted too — but
 * only ever as a fallback, checked after canonicalUrlHint, never instead of it.
 */
export function parseIttiCategoryProduct(payload: { is_product?: boolean; data?: IttiPayload }, productUrl: string, canonicalUrlHint: RegExp, nameFallbackHint?: RegExp): StoreProduct[] {
  const [product] = parseIttiProduct(payload, productUrl);
  const canonicalUrl = payload.data?.canonical_url || "";
  const matchesCanonical = canonicalUrlHint.test(canonicalUrl);
  const matchesNameFallback = Boolean(nameFallbackHint && nameFallbackHint.test(payload.data?.name || ""));
  if (!matchesCanonical && !matchesNameFallback) throw new Error(`unexpected category (canonical_url: ${canonicalUrl || "unknown"})`);
  return [{ ...product, externalId: String(payload.data!.pid) }];
}

export const GAMING_CANONICAL_URL_HINT = /\bconsoles?\b/i;
export const GAMING_NAME_FALLBACK_HINT = /playstation|\bxbox\b|nintendo switch|gaming console|gaming handheld|handheld.*gaming/i;
