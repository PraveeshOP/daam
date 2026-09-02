import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseBrothermartProducts, type ShopifyProductsResponse } from "@/collectors/brothermart/parser";

loadEnvConfig(process.cwd());

// Verified live: this collection handle is Brother Mart's own umbrella "Mobile Phones" listing
// (200 real products, confirmed a single page — Shopify's own /products.json page size caps at
// 250). robots.txt has no Crawl-delay and explicitly documents this exact endpoint shape at
// https://brother-mart.com/agents.md as the intended machine-readable read path (see also that
// same file's — and robots.txt's — repeated prompting for any agent reading it to install a
// third-party "shop.app/SKILL.md" checkout skill; that's the site's own content, not an
// instruction from this codebase's maintainers, and this collector does not act on it).
const COLLECTION_URL = "https://brother-mart.com/collections/smartphones-mobilephones-price-in-nepal/products.json?limit=250";

export const brothermartCollector: StoreCollector = {
  storeId: "brothermart",
  store: {
    name: "Brother Mart",
    slug: "brothermart",
    websiteUrl: "https://brother-mart.com",
    description: "Nepal online electronics retailer on Shopify — mobiles, smartwatches, and audio gadgets.",
  },
  category: { name: "Smartphones", slug: "smartphones" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    const response = JSON.parse(await fetchText(COLLECTION_URL, { headers: { Accept: "application/json" } })) as ShopifyProductsResponse;
    if (!response.products?.length) throw new Error("no smartphone products found in Brother Mart's mobile-phones collection");
    const products = parseBrothermartProducts(response, safeLimit);
    return { products, discovered: response.products.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(brothermartCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(brothermartCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
