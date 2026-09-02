import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseBigbyteProducts, BIGBYTE_CAMERA_CATEGORY_ID, type BigbyteProduct } from "@/collectors/bigbyte/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay.
// Verified live no WAF block of any tested User-Agent.
const STORE_API_URL = `https://bigbyte.com.np/wp-json/wc/store/v1/products?category=${BIGBYTE_CAMERA_CATEGORY_ID}&per_page=100`;

export const bigbyteCollector: StoreCollector = {
  storeId: "bigbyte",
  store: {
    name: "Bigbyte IT World",
    slug: "bigbyte",
    websiteUrl: "https://bigbyte.com.np",
    description: "Nepal online electronics retailer — laptops, TVs, security cameras, and gaming gear.",
  },
  category: { name: "Cameras", slug: "cameras" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const raw = await fetchText(STORE_API_URL, { headers: { Accept: "application/json" } });
    const items = JSON.parse(raw) as BigbyteProduct[];
    if (!items.length) throw new Error("no camera products found in Bigbyte's IP Cameras category");
    const products = parseBigbyteProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(bigbyteCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(bigbyteCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
