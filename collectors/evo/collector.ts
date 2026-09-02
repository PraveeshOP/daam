import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseProductPage, parseProductUrls } from "@/collectors/evo/parser";

loadEnvConfig(process.cwd());

const SITEMAP_URL = "https://evostore.com.np/sitemap.xml";

export const evoCollector: StoreCollector = {
  storeId: "evo-store",
  store: { name: "Evo Store", slug: "evo-store", websiteUrl: "https://evostore.com.np", logoUrl: "https://evostore.com.np/catalog/view/theme/evostore/assets/img/logo/evo-logo-black.svg", description: "Apple Authorized Reseller and Nepal electronics retailer." },
  category: { name: "Smartphones", slug: "smartphones" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    const sitemap = await fetchText(SITEMAP_URL, { headers: { Accept: "application/xml" } });
    const urls = parseProductUrls(sitemap, safeLimit);
    if (!urls.length) throw new Error("no smartphone URLs found in Evo sitemap");
    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const url of urls) {
      try {
        const parsed = parseProductPage(await fetchText(url), url);
        products.push(...parsed);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        // Non-product pages (accessories, category pages) are expected in a sitemap crawl, not failures.
        if (!message.startsWith("missing product JSON-LD")) errors.push({ url, message });
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
  const { summary, durationMs } = await runStoreCollection(evoCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(evoCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
