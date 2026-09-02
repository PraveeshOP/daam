import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseMaxProducts, MAX_LAPTOP_CATEGORY_ID, type MaxProduct } from "@/collectors/maxinternational/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay.
// Verified live no WAF block of any tested User-Agent.
const STORE_API_URL = `https://maxnepal.com.np/wp-json/wc/store/v1/products?category=${MAX_LAPTOP_CATEGORY_ID}&per_page=100`;

export const maxinternationalCollector: StoreCollector = {
  storeId: "maxinternational",
  store: {
    name: "Max International",
    slug: "maxinternational",
    websiteUrl: "https://maxnepal.com.np",
    description: "Nepal online electronics retailer — a large laptop catalog.",
  },
  category: { name: "Laptops", slug: "laptops" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const raw = await fetchText(STORE_API_URL, { headers: { Accept: "application/json" } });
    const items = JSON.parse(raw) as MaxProduct[];
    if (!items.length) throw new Error("no laptop products found in Max International's Laptops category");
    const products = parseMaxProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(maxinternationalCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(maxinternationalCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
