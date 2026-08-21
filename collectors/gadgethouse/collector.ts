import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseGadgetHouseProducts, GADGETHOUSE_SMARTWATCH_CATEGORY_ID, type GadgetHouseProduct } from "@/collectors/gadgethouse/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay.
// Verified live that this site's WAF does NOT block the shared COLLECTOR_USER_AGENT (unlike
// smartdoko.com), so this needs no User-Agent override.
const STORE_API_URL = `https://gadgethousenepal.com/wp-json/wc/store/v1/products?category=${GADGETHOUSE_SMARTWATCH_CATEGORY_ID}&per_page=100`;

export const gadgethouseCollector: StoreCollector = {
  storeId: "gadgethouse",
  store: {
    name: "Gadget House Nepal",
    slug: "gadgethouse",
    websiteUrl: "https://gadgethousenepal.com",
    description: "Nepal online electronics retailer — mobile accessories and smartwatches.",
  },
  category: { name: "Smartwatches", slug: "smartwatches" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const raw = await fetchText(STORE_API_URL, { headers: { Accept: "application/json" } });
    const items = JSON.parse(raw) as GadgetHouseProduct[];
    if (!items.length) throw new Error("no smartwatch products found in Gadget House Nepal's Smartwatch category");
    const products = parseGadgetHouseProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(gadgethouseCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(gadgethouseCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
