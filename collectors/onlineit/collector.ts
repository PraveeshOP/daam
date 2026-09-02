import { loadEnvConfig } from "@next/env";
import { fetchAllWooCommerceItems } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseOnlineItProducts, ONLINEIT_LAPTOP_CATEGORY_ID, type OnlineItProduct } from "@/collectors/onlineit/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay.
// Verified live no WAF block of any tested User-Agent.
const STORE_API_URL = `https://onlineit.com.np/wp-json/wc/store/v1/products?category=${ONLINEIT_LAPTOP_CATEGORY_ID}`;

export const onlineitCollector: StoreCollector = {
  storeId: "onlineit",
  store: {
    name: "Online IT",
    slug: "onlineit",
    websiteUrl: "https://onlineit.com.np",
    description: "Nepal online electronics retailer — a large laptop catalog.",
  },
  category: { name: "Laptops", slug: "laptops" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    // Online IT's Laptops category holds 479 real listings (verified live via X-WP-Total) —
    // past WooCommerce Store API's 100-item/page ceiling, so this pages through until
    // exhausted rather than trusting a single request.
    const items = await fetchAllWooCommerceItems<OnlineItProduct>(STORE_API_URL, { maxItems: safeLimit });
    if (!items.length) throw new Error("no laptop products found in Online IT's Laptops category");
    const products = parseOnlineItProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(onlineitCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(onlineitCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
