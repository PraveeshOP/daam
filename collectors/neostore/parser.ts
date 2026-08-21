import type { Availability, StoreProduct } from "@/collectors/evo/types";

/**
 * Neostore, unlike Evo/ITTI/Mobilemandu, has no JSON-LD Product schema and no JSON API — this is
 * a best-effort raw-HTML scraper for a plain WooCommerce theme, genuinely more fragile than the
 * other three collectors (no structured-data ground truth to validate against). Every extraction
 * below is deliberately scoped to a narrow window anchored on two markers that were verified live
 * to appear exactly once per product page (`product_title entry-title`, `woocommerce-breadcrumb`)
 * — a naive whole-document search picks up unrelated nav-menu/mega-menu boilerplate that repeats
 * the same link text (e.g. "Shop By Brands" appears 6 times on one real page; only one of them is
 * the actual breadcrumb for the product being viewed).
 */

const decodeHtml = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
const toPrice = (value: string) => {
  const price = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(price) && price > 0 ? price : null;
};

/**
 * Verified live: WooCommerce renders a sale price inside `<ins>` (current) alongside the
 * original inside `<del>` — when there's no sale, there's just one `.woocommerce-Price-amount`
 * with no `<ins>`/`<del>` wrapper. Either way, the *first* `woocommerce-Price-amount` found in
 * the product's own price block is the price to charge today.
 */
function extractPrice(scope: string): number | null {
  const priceStart = scope.indexOf('<p class="price">');
  if (priceStart === -1) return null;
  // A fixed-size window rather than trying to regex-match the real closing </p> — this markup
  // nests several spans deep (currency symbol, <bdi>, sale vs. regular price), and the first
  // amount found within a few hundred characters of "price" starting is reliably the right one.
  const priceBlock = scope.slice(priceStart, priceStart + 800);
  const amount = priceBlock.match(/woocommerce-Price-amount[^>]*>[\s\S]*?(\d[\d,]*\.?\d*)/);
  return amount ? toPrice(amount[1]) : null;
}

/**
 * No explicit stock-status text exists on this theme's product page (verified live — no
 * `class="stock ..."` element anywhere) — the closest reliable signal is whether the "Add to
 * cart"/"Buy Now" button is actually present and not disabled. WooCommerce removes or disables
 * that button for an out-of-stock product rather than rendering explicit status text here.
 */
function extractAvailability(scope: string): Availability {
  const button = scope.match(/<button[^>]*single_add_to_cart_button[^>]*>/);
  if (!button) return "out_of_stock";
  return /disabled/i.test(button[0]) ? "out_of_stock" : "in_stock";
}

export function parseNeostoreProduct(html: string, productUrl: string): StoreProduct[] {
  const titleMatch = html.match(/product_title entry-title">([^<]+)/);
  if (!titleMatch) throw new Error("missing product title");
  const name = decodeHtml(titleMatch[1]);
  const titleIndex = html.indexOf("product_title entry-title");

  const breadcrumbIndex = html.indexOf("woocommerce-breadcrumb");
  const brandLinks = breadcrumbIndex >= 0 && breadcrumbIndex < titleIndex
    ? [...html.slice(breadcrumbIndex, titleIndex).matchAll(/<a href="[^"]*">([^<]+)<\/a>/g)].map((m) => decodeHtml(m[1]))
    : [];
  const brand = brandLinks.length ? brandLinks[brandLinks.length - 1] : undefined;

  const summaryScope = html.slice(titleIndex, titleIndex + 8000);
  const price = extractPrice(summaryScope);
  if (!price) throw new Error("missing or invalid price");
  const availability = extractAvailability(summaryScope);

  const imageScope = html.slice(Math.max(0, titleIndex - 8000), titleIndex + 500);
  const image = imageScope.match(/(?:src|data-src)="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/);

  // No reliable SKU on this site (often literally "N/A" — verified live), and no numeric
  // internal id is exposed to a plain HTML scrape the way ITTI's JSON API exposes `pid` — the
  // product URL path is the one thing guaranteed unique and stable per listing here.
  const externalId = new URL(productUrl).pathname.replace(/^\/product\//, "").replace(/\/$/, "");

  return [{
    externalId,
    name,
    brand,
    price,
    currency: "NPR",
    imageUrl: image?.[1],
    productUrl,
    availability,
  }];
}

/** No sitemap exists for this site — product URLs are discovered by crawling specific category
 * pages directly (see collector.ts for which ones) rather than a site-wide sitemap.xml. */
export function parseNeostoreProductLinks(categoryPageHtml: string, limit = 20): string[] {
  return [...new Set([...categoryPageHtml.matchAll(/href="(https:\/\/www\.neostore\.com\.np\/product\/[^"]+)"/g)].map((m) => m[1]))].slice(0, limit);
}
