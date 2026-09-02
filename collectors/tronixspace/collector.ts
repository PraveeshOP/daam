import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseTronixspaceProducts, TRONIXSPACE_GAMING_CATEGORY_ID, type TronixspaceProduct } from "@/collectors/tronixspace/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay.
// Verified live no WAF block of any tested User-Agent. Only 4 real products exist in this
// category (verified live) — a genuinely small but real gaming assortment on this site.
const STORE_API_URL = `https://tronixspace.com/wp-json/wc/store/v1/products?category=${TRONIXSPACE_GAMING_CATEGORY_ID}&per_page=100`;

export const tronixspaceCollector: StoreCollector = {
  storeId: "tronixspace",
  store: {
    name: "Tronixspace",
    slug: "tronixspace",
    websiteUrl: "https://tronixspace.com",
    description: "Nepal online electronics retailer — laptops, monitors, and gaming gear.",
  },
  category: { name: "Gaming", slug: "gaming" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const raw = await fetchText(STORE_API_URL, { headers: { Accept: "application/json" } });
    const items = JSON.parse(raw) as TronixspaceProduct[];
    if (!items.length) throw new Error("no gaming products found in Tronixspace's Gaming category");
    const products = parseTronixspaceProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(tronixspaceCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(tronixspaceCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
