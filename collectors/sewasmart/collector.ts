import { loadEnvConfig } from "@next/env";
import { fetchAllWooCommerceItems } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseSewasmartProducts, SEWASMART_AC_CATEGORY_ID, type SewasmartProduct } from "@/collectors/sewasmart/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay.
// Verified live no WAF block of any tested User-Agent.
const STORE_API_URL = `https://sewasmart.com/wp-json/wc/store/v1/products?category=${SEWASMART_AC_CATEGORY_ID}`;

export const sewasmartCollector: StoreCollector = {
  storeId: "sewasmart",
  store: {
    name: "SewasMart",
    slug: "sewasmart",
    websiteUrl: "https://sewasmart.com",
    description: "Nepal online electronics retailer — air conditioners and water heaters.",
  },
  category: { name: "Home appliances", slug: "home-appliances" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    // 61 real listings today (verified live) — comfortably under one page, but paginating
    // unconditionally means this keeps fetching everything if the category ever grows past 100.
    const items = await fetchAllWooCommerceItems<SewasmartProduct>(STORE_API_URL, { maxItems: safeLimit });
    if (!items.length) throw new Error("no AC products found in SewasMart's Air Conditioner category");
    const products = parseSewasmartProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(sewasmartCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(sewasmartCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
