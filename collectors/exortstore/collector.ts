import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseExortstoreProduct, parseExortstoreProductUrls, EXORTSTORE_SMARTWATCH_CATEGORY_URL } from "@/collectors/exortstore/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay —
// /category/ and /product/ are explicitly not blocked (only /admin/, /seller/, /cart/, checkout,
// account-area paths are). Verified live no WAF block of any tested User-Agent.
export const exortstoreCollector: StoreCollector = {
  storeId: "exortstore",
  store: {
    name: "Exort Store",
    slug: "exortstore",
    websiteUrl: "https://exortstore.com",
    description: "Nepal online electronics retailer — PC components, gadgets, and smartwatches.",
  },
  category: { name: "Smartwatches", slug: "smartwatches" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    const categoryHtml = await fetchText(EXORTSTORE_SMARTWATCH_CATEGORY_URL, { headers: { Accept: "text/html" } });
    const urls = parseExortstoreProductUrls(categoryHtml, safeLimit);
    if (!urls.length) throw new Error("no smartwatch product URLs found on Exort Store's Smart Watch category page");
    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const url of urls) {
      try {
        products.push(...parseExortstoreProduct(await fetchText(url), url));
      } catch (error) {
        errors.push({ url, message: error instanceof Error ? error.message : "unknown error" });
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
  const { summary, durationMs } = await runStoreCollection(exortstoreCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(exortstoreCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
