import { loadEnvConfig } from "@next/env";
import { fetchAllWooCommerceItems } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseTechinnProducts, TECHINN_LAPTOP_CATEGORY_ID, type TechinnProduct } from "@/collectors/techinn/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay.
// Verified live that this site's WAF does NOT block the shared COLLECTOR_USER_AGENT.
const STORE_API_URL = `https://techinn.com.np/wp-json/wc/store/v1/products?category=${TECHINN_LAPTOP_CATEGORY_ID}`;

export const techinnCollector: StoreCollector = {
  storeId: "techinn",
  store: {
    name: "Techinn",
    slug: "techinn",
    websiteUrl: "https://techinn.com.np",
    description: "Nepal online electronics retailer — laptops, printers, and office peripherals.",
  },
  category: { name: "Laptops", slug: "laptops" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    // 85 real listings today (verified live) — comfortably under one page, but paginating
    // unconditionally means this keeps fetching everything if the category ever grows past 100.
    const items = await fetchAllWooCommerceItems<TechinnProduct>(STORE_API_URL, { maxItems: safeLimit });
    if (!items.length) throw new Error("no laptop products found in Techinn's Laptops category");
    const products = parseTechinnProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(techinnCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(techinnCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
