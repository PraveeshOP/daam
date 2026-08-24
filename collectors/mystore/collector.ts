import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseMystoreListing } from "@/collectors/mystore/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector) has no User-agent/Disallow/Crawl-delay lines
// at all — only a content-signals/AI-licensing comment block. Verified live: no bot-walling of
// any of the three tested User-Agents, this codebase's own COLLECTOR_USER_AGENT included.
const CATEGORY_URL = "https://mystore.com.np/category/smart-phone";

export const mystoreCollector: StoreCollector = {
  storeId: "mystore",
  store: {
    name: "My Store",
    slug: "mystore",
    websiteUrl: "https://mystore.com.np",
    description: "Nepal online electronics retailer — a multi-brand smartphone catalog.",
  },
  category: { name: "Smartphones", slug: "smartphones" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const html = await fetchText(CATEGORY_URL, { headers: { Accept: "text/html" } });
    const allProducts = parseMystoreListing(html);
    if (!allProducts.length) throw new Error("no phone products found on My Store's smart-phone category page");
    return { products: allProducts.slice(0, safeLimit), discovered: allProducts.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(mystoreCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(mystoreCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
