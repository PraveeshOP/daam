import type { StoreProduct } from "@/collectors/evo/types";

const decodeHtml = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();

/**
 * Verified live: no brand taxonomy is exposed on the category listing page (no JSON-LD, no data
 * API — this is a custom PHP/jQuery storefront, not WooCommerce/Shopify/Magento) — brand is
 * derived from a known-brand prefix in the product title instead, matching the real brands this
 * site's smartphone catalog carries (verified across the real sample: "Redmi A3...", "Realme
 * C75...", "Samsung Galaxy...").
 */
const KNOWN_PHONE_BRAND_PREFIX = /^(samsung|xiaomi|redmi|poco|oneplus|realme|oppo|vivo|apple|iphone|nothing|honor|infinix|tecno|itel|huawei|nokia|motorola|google|pixel)/i;
function guessBrand(name: string): string | undefined {
  const match = name.match(KNOWN_PHONE_BRAND_PREFIX);
  return match ? match[0].toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined;
}

/** Extracts RAM/storage from a "(4/64)"-style shorthand in the title — this site's own
 * convention, distinct from every other store's shorthand format seen this session (Hukut's
 * "4/128GB", Brother Mart's "4GB+128GB") — same idea, different literal shape. */
function extractRamStorage(name: string): { ram?: string; storage?: string } {
  const shorthand = name.match(/\((\d+)\s*\/\s*(\d+)\)/);
  return shorthand ? { ram: `${shorthand[1]}GB`, storage: `${shorthand[2]}GB` } : {};
}

/**
 * No JSON API on this site at all — a custom PHP storefront. Verified live that the category
 * listing page itself already embeds everything needed (id, title, image, price) per product
 * card, so this scrapes the listing directly rather than needing a second per-product HTML fetch
 * the way collectors/neostore/parser.ts or collectors/zolpastore/parser.ts do. Each product card
 * is delimited by a `class="product-media"` marker; every card on this site's listing pages
 * renders TWICE (verified live: 80 raw matches, 40 unique `data-id`s — likely a duplicate
 * desktop/mobile layout), so this dedupes by id.
 *
 * No `sku` field exists anywhere on this site (verified live) — the numeric `data-id` /
 * `data-productId` is the only identifier, and it's confirmed unique per product.
 */
export function parseMystoreListing(html: string): StoreProduct[] {
  const cards = html.split('class="product-media"').slice(1);
  const seen = new Set<string>();
  const rows: StoreProduct[] = [];

  for (const card of cards) {
    const link = card.match(/<a href="(https:\/\/mystore\.com\.np\/product\/[^"]+)"\s*\n?\s*title="([^"]*)"\s*data-id=(\d+)>/);
    if (!link) continue;
    const [, productUrl, rawTitle, id] = link;
    if (seen.has(id)) continue;
    seen.add(id);

    const priceMatches = [...card.matchAll(/price_list">\s*Rs\.\s*([\d,]+)/g)].map((match) => Number(match[1].replace(/,/g, "")));
    const price = priceMatches.length ? Math.min(...priceMatches) : null;
    if (!price) continue;

    const name = decodeHtml(rawTitle);
    const { ram, storage } = extractRamStorage(name);
    const image = card.match(/<img src="([^"]+)"/)?.[1];

    rows.push({
      externalId: id,
      name,
      brand: guessBrand(name),
      ram,
      storage,
      price,
      currency: "NPR",
      imageUrl: image,
      productUrl,
      availability: "unknown", // stock is only exposed on the product detail page's embedded JS, not this listing
    });
  }
  return rows;
}
