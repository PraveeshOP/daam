import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseZolpastoreProduct, parseZolpastoreProductUrls, ZOLPASTORE_LAPTOP_CATEGORY } from "@/collectors/zolpastore/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): a general `User-Agent: *` block explicitly
// allows /shop/ and /category/, disallows only cart/checkout/login/profile — no Crawl-delay on
// general crawlers (a separate, narrow bot group — Googlebot-Image, AhrefsBot, MJ12bot, Pinterest,
// msnbot — gets Crawl-delay: 10, but that doesn't apply here). Uses the products sitemap (not the
// category page, which only serves its first ~12 items server-side and needs client-side
// pagination this collector doesn't attempt) for URL discovery.
const PRODUCTS_SITEMAP_URL = "https://zolpastore.com/sitemaps/products.xml";

export const zolpastoreCollector: StoreCollector = {
  storeId: "zolpastore",
  store: {
    name: "Zolpa Store",
    slug: "zolpastore",
    websiteUrl: "https://zolpastore.com",
    description: "Nepal online electronics retailer — laptops, gaming PCs, and gadgets.",
  },
  category: { name: "Laptops", slug: "laptops" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    const sitemap = await fetchText(PRODUCTS_SITEMAP_URL, { headers: { Accept: "application/xml" } });
    const urls = parseZolpastoreProductUrls(sitemap, safeLimit);
    if (!urls.length) throw new Error("no laptop product URLs found in Zolpa Store's products sitemap");
    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const url of urls) {
      try {
        products.push(...parseZolpastoreProduct(await fetchText(url), url, ZOLPASTORE_LAPTOP_CATEGORY));
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        // Non-laptop pages that slipped past the URL-level filter (gaming monitors, cooling pads,
        // custom PC builds whose slug mentions a laptop brand) are expected, not failures — same
        // treatment as every other JSON-LD collector's "unexpected category" skip.
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
  const { summary, durationMs } = await runStoreCollection(zolpastoreCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(zolpastoreCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
