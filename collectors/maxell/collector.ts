import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseMaxellProduct, parseMaxellProductUrls, MAXELL_LAPTOP_CATEGORY } from "@/collectors/maxell/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay.
// Verified live no WAF block of any tested User-Agent.
const PRODUCTS_SITEMAP_URL = "https://maxell.com.np/sitemap-products.xml";

export const maxellCollector: StoreCollector = {
  storeId: "maxell",
  store: {
    name: "Maxell Computer",
    slug: "maxell",
    websiteUrl: "https://maxell.com.np",
    description: "Nepal online electronics retailer — a laptop-first catalog.",
  },
  category: { name: "Laptops", slug: "laptops" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const sitemap = await fetchText(PRODUCTS_SITEMAP_URL, { headers: { Accept: "application/xml" } });
    const urls = parseMaxellProductUrls(sitemap, safeLimit);
    if (!urls.length) throw new Error("no laptop product URLs found in Maxell Computer's products sitemap");
    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const url of urls) {
      try {
        products.push(...parseMaxellProduct(await fetchText(url), url, MAXELL_LAPTOP_CATEGORY));
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
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
  const { summary, durationMs } = await runStoreCollection(maxellCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(maxellCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
