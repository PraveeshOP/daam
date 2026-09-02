import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseComputerPlanetProducts, COMPUTERPLANET_LAPTOP_CATEGORY_ID, type ComputerPlanetProductsResponse } from "@/collectors/computerplanet/parser";

loadEnvConfig(process.cwd());

// This site's own /llms.txt documents a public read API at /api/v1/ specifically for agents like
// this collector. robots.txt has no bot-specific disallow and no Crawl-delay. Verified live: all
// three of a plain curl UA, a browser UA, and this codebase's own COLLECTOR_USER_AGENT get a
// clean 200 — no WAF block of any kind, unlike smartdoko.com or infotechsnepal.com.np.
const API_URL = `https://cplanetnp.com/api/v1/products?category_id=${COMPUTERPLANET_LAPTOP_CATEGORY_ID}&page_size=100`;

export const computerplanetCollector: StoreCollector = {
  storeId: "computerplanet",
  store: {
    name: "Computer Planet",
    slug: "computerplanet",
    websiteUrl: "https://cplanetnp.com",
    description: "Nepal online electronics retailer — a large laptop catalog.",
  },
  category: { name: "Laptops", slug: "laptops" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    const raw = await fetchText(API_URL, { headers: { Accept: "application/json" } });
    const response = JSON.parse(raw) as ComputerPlanetProductsResponse;
    const items = response.data?.data;
    if (!items?.length) throw new Error("no laptop products found in Computer Planet's Laptops category");
    const products = parseComputerPlanetProducts(response, safeLimit);
    return { products, discovered: response.data?.total_items ?? items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(computerplanetCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(computerplanetCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
