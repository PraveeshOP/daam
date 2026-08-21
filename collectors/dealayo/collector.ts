import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseDealayoProducts, DEALAYO_MOBILES_CATEGORY_ID, type DealayoProductsResponse } from "@/collectors/dealayo/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): explicitly allows ClaudeBot (among
// OAI-SearchBot/ChatGPT-User/PerplexityBot/Applebot/Bingbot/Googlebot) — only GPTBot is
// disallowed. No Crawl-delay. Verified live that plain curl, a browser User-Agent, and this exact
// collector's own User-Agent all get byte-identical 200 responses — no WAF block like
// smartdoko.com. GraphQL is open with no auth and no observed rate-limiting, and is dramatically
// more reliable here than the sitemap, which was found live to be stale (missing 3 of 4 spot-
// checked current product URLs entirely).
const GRAPHQL_URL = "https://dealayo.com/graphql";

const QUERY = `query PhonesForPriceComparison($categoryId: String!, $pageSize: Int!) {
  products(filter: { category_id: { eq: $categoryId } }, pageSize: $pageSize, currentPage: 1) {
    total_count
    items { id sku name url_key stock_status price_range { minimum_price { final_price { value currency } } } image { url } }
  }
}`;

export const dealayoCollector: StoreCollector = {
  storeId: "dealayo",
  store: {
    name: "DealAyo",
    slug: "dealayo",
    websiteUrl: "https://dealayo.com",
    description: "Nepal general online marketplace — electronics, appliances, and household goods.",
  },
  category: { name: "Smartphones", slug: "smartphones" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const raw = await fetchText(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { categoryId: DEALAYO_MOBILES_CATEGORY_ID, pageSize: safeLimit } }),
    });
    const response = JSON.parse(raw) as DealayoProductsResponse;
    const items = response.data?.products;
    if (!items?.items.length) throw new Error("no phone products found in DealAyo's Mobiles category");
    const products = parseDealayoProducts(response, safeLimit);
    return { products, discovered: items.total_count, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(dealayoCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(dealayoCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
