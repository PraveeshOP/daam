import { loadEnvConfig } from "@next/env";
import { fetchAllWooCommerceItems } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseYantraProducts, YANTRA_LAPTOP_CATEGORY_ID, type YantraProduct } from "@/collectors/yantranepal/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay.
// Verified live that this site's WAF does NOT block the shared COLLECTOR_USER_AGENT (unlike
// smartdoko.com), so this needs no User-Agent override.
const STORE_API_URL = `https://yantranepal.com/wp-json/wc/store/v1/products?category=${YANTRA_LAPTOP_CATEGORY_ID}`;

export const yantranepalCollector: StoreCollector = {
  storeId: "yantranepal",
  store: {
    name: "Yantra Nepal",
    slug: "yantranepal",
    websiteUrl: "https://yantranepal.com",
    description: "Nepal online electronics retailer — a large laptop catalog.",
  },
  category: { name: "Laptops", slug: "laptops" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    // Yantra Nepal's Laptops category holds 770 real listings (verified live via X-WP-Total) —
    // well past WooCommerce Store API's 100-item/page ceiling, so this pages through until
    // exhausted rather than trusting a single request.
    const items = await fetchAllWooCommerceItems<YantraProduct>(STORE_API_URL, { maxItems: safeLimit });
    if (!items.length) throw new Error("no laptop products found in Yantra Nepal's Laptops category");
    const products = parseYantraProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(yantranepalCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(yantranepalCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
