import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseLdsProducts, type LdsProduct } from "@/collectors/lds/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay,
// /wp-json/ not blocked. Category id 15 ("Laptop", verified live) is the umbrella parent whose
// count (48) exactly equals the sum of its brand subcategories (Acer 11 + Apple 3 + Asus 6 +
// Dell 5 + HP 6 + Lenovo 17), confirmed via the public, unauthenticated WooCommerce Store API —
// no bot-walling encountered (unlike smartdoko.com, this site's own custom collector User-Agent
// works fine, verified live).
const LAPTOP_CATEGORY_ID = 15;
const STORE_API_URL = `https://lds.com.np/wp-json/wc/store/v1/products?category=${LAPTOP_CATEGORY_ID}&per_page=100`;

export const ldsCollector: StoreCollector = {
  storeId: "lds",
  store: {
    name: "LDS",
    slug: "lds",
    websiteUrl: "https://lds.com.np",
    description: "Logix Digital System — a Kathmandu IT/computer-equipment reseller in Nepal.",
  },
  category: { name: "Laptops", slug: "laptops" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const raw = await fetchText(STORE_API_URL, { headers: { Accept: "application/json" } });
    const items = JSON.parse(raw) as LdsProduct[];
    if (!items.length) throw new Error("no laptop products found in LDS's Laptop category");
    const products = parseLdsProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(ldsCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(ldsCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
