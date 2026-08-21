import { delay, fetchText } from "@/collectors/core/http";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseMobilemanduProduct, filterMobilemanduUrls } from "@/collectors/mobilemandu/parser";

const PRODUCTS_SITEMAP_URL = "https://mobilemandu.com/sitemaps/products.xml";

export type MobilemanduCategoryConfig = {
  storeId: string;
  categoryName: string;
  categorySlug: string;
  expectedCategory: string | RegExp;
  urlHint: RegExp;
  urlExclude?: RegExp;
};

/**
 * Mobilemandu turned out to carry real inventory across several more of our catalog categories
 * (Audio, TVs, Smartwatches, Home appliances — verified via its own sitemap and JSON-LD before
 * writing any of this), each needing only a different URL pre-filter and expected-category
 * check on top of the exact same generic parser already used for phones/laptops. Factored into
 * one shared collector shape here rather than four more near-copies of collector.ts, now that
 * this is the fifth store+category combination for this site.
 */
export function createMobilemanduCategoryCollector(config: MobilemanduCategoryConfig): StoreCollector {
  return {
    storeId: config.storeId,
    store: {
      name: "Mobilemandu",
      slug: "mobilemandu",
      websiteUrl: "https://mobilemandu.com",
      description: "Nepal online electronics retailer — mobiles, laptops, and home appliances.",
    },
    category: { name: config.categoryName, slug: config.categorySlug },
    async collect({ limit = 20 } = {}): Promise<CollectResult> {
      const safeLimit = Math.min(Math.max(limit, 1), 50);
      const sitemap = await fetchText(PRODUCTS_SITEMAP_URL, { headers: { Accept: "application/xml" } });
      const urls = filterMobilemanduUrls(sitemap, config.urlHint, config.urlExclude, safeLimit);
      if (!urls.length) throw new Error(`no ${config.categoryName} URLs found in Mobilemandu products sitemap`);
      const products: CollectResult["products"] = [];
      const errors: CollectResult["errors"] = [];
      for (const url of urls) {
        try {
          products.push(...parseMobilemanduProduct(await fetchText(url), url, config.expectedCategory));
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown error";
          // Wrong-category pages that slipped past the URL-level filter are expected, not
          // failures — same treatment as every other collector's non-product/wrong-category skip.
          if (!message.startsWith("missing product JSON-LD") && !message.startsWith("unexpected category")) errors.push({ url, message });
        }
        await delay(750);
      }
      return { products, discovered: urls.length, errors };
    },
  };
}
