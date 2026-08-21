import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseHukutProduct, parseHukutProductUrls, HUKUT_LAPTOP_URL_HINT, HUKUT_LAPTOP_URL_EXCLUDE, HUKUT_LAPTOP_CATEGORY } from "@/collectors/hukut/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector) is a single universal `User-Agent: *`
// rule, `Allow: /` with only account/cart/checkout paths disallowed — no Crawl-delay, no
// bot-specific block. This sitemap is the *products* sub-sitemap specifically: the sibling
// pages.xml sitemap shares the exact same flat root-path URL shape, so pointing this collector
// anywhere but here would silently start pulling in blog articles.
const PRODUCTS_SITEMAP_URL = "https://hukut.com/sitemaps/sitemap/products.xml";

export const hukutCollector: StoreCollector = {
  storeId: "hukut-laptops",
  store: {
    name: "Hukut Store",
    slug: "hukut",
    websiteUrl: "https://hukut.com",
    description: "Nepal online electronics retailer — mobiles, laptops, and gadgets.",
  },
  category: { name: "Laptops", slug: "laptops" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const sitemap = await fetchText(PRODUCTS_SITEMAP_URL, { headers: { Accept: "application/xml" } });
    const urls = parseHukutProductUrls(sitemap, HUKUT_LAPTOP_URL_HINT, HUKUT_LAPTOP_URL_EXCLUDE, safeLimit);
    if (!urls.length) throw new Error("no laptop product URLs found in Hukut products sitemap");
    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const url of urls) {
      try {
        products.push(...parseHukutProduct(await fetchText(url), url, HUKUT_LAPTOP_CATEGORY));
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        // Non-laptop products that slipped past the URL-level filter (gaming monitors, laptop
        // bags/coolers whose slug happens to mention a laptop brand) are expected, not failures —
        // same treatment as every other JSON-LD collector's "unexpected category" skip.
        if (!message.startsWith("missing product JSON-LD") && !message.startsWith("unexpected category")) errors.push({ url, message });
      }
      await delay(750);
    }
    return { products, discovered: urls.length, errors };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(hukutCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(hukutCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
