import { loadEnvConfig } from "@next/env";
import { fetchAllWooCommerceItems } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseElectromanduProducts, ELECTROMANDU_REFRIGERATOR_CATEGORY_ID, type ElectromanduProduct } from "@/collectors/electromandu/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay.
// Verified live that this site's WAF does NOT block the shared COLLECTOR_USER_AGENT.
const STORE_API_URL = `https://electromandu.com/wp-json/wc/store/v1/products?category=${ELECTROMANDU_REFRIGERATOR_CATEGORY_ID}`;

export const electromanduCollector: StoreCollector = {
  storeId: "electromandu",
  store: {
    name: "Electromandu",
    slug: "electromandu",
    websiteUrl: "https://electromandu.com",
    description: "Nepal online electronics retailer — home appliances and electronics.",
  },
  category: { name: "Home appliances", slug: "home-appliances" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    // Electromandu's Refrigerators category holds 238 real listings (verified live via
    // X-WP-Total) — past WooCommerce Store API's 100-item/page ceiling, so this pages through
    // until exhausted rather than trusting a single request.
    const items = await fetchAllWooCommerceItems<ElectromanduProduct>(STORE_API_URL, { maxItems: safeLimit });
    if (!items.length) throw new Error("no refrigerator products found in Electromandu's Refrigerators category");
    const products = parseElectromanduProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(electromanduCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(electromanduCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
