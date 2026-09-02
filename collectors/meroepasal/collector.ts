import { loadEnvConfig } from "@next/env";
import { fetchAllWooCommerceItems } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseMeroepasalProducts, MEROEPASAL_APPLIANCE_CATEGORY_IDS, type MeroepasalProduct } from "@/collectors/meroepasal/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay.
// Verified live no WAF block of any tested User-Agent.
const STORE_API_BASE = "https://meroepasal.com/wp-json/wc/store/v1/products";

// One of these four categories (94) gets measurably slower per item added to the page — 10/page
// is usually ~1.5s but has been observed to spike well past our normal 15s request timeout even
// at that size (verified live, with real variance run to run) — so this paginates in smaller
// pages across all four categories AND gives itself a longer timeout as headroom against that
// server-side flakiness, rather than trusting either page size or timeout alone.
const PAGE_SIZE = 10;
const REQUEST_TIMEOUT_MS = 30_000;

export const meroepasalCollector: StoreCollector = {
  storeId: "meroepasal",
  store: {
    name: "MeroEpasal",
    slug: "meroepasal",
    websiteUrl: "https://meroepasal.com",
    description: "Nepal online electronics retailer — home appliances (ACs, refrigerators, washing machines, water purifiers).",
  },
  category: { name: "Home appliances", slug: "home-appliances" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    let discovered = 0;
    const items: MeroepasalProduct[] = [];
    for (const categoryId of MEROEPASAL_APPLIANCE_CATEGORY_IDS) {
      const categoryItems = await fetchAllWooCommerceItems<MeroepasalProduct>(`${STORE_API_BASE}?category=${categoryId}`, { perPage: PAGE_SIZE, maxItems: safeLimit, timeoutMs: REQUEST_TIMEOUT_MS });
      discovered += categoryItems.length;
      items.push(...categoryItems);
    }
    if (!items.length) throw new Error("no appliance products found across MeroEpasal's AC/fridge/washer/water-purifier categories");
    const products = parseMeroepasalProducts(items, safeLimit);
    return { products, discovered, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(meroepasalCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(meroepasalCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
