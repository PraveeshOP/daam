import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseInfotechsProducts, INFOTECHS_LAPTOP_CATEGORY_ID, type InfotechsProduct } from "@/collectors/infotechsnepal/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): no bot-specific disallow, no Crawl-delay.
// Verified live this site has the OPPOSITE bot-protection profile from smartdoko.com: Cloudflare
// consistently 403s a browser-spoofing User-Agent ("Mozilla/5.0 ... Chrome/...") on this REST
// endpoint, while both a bare/default UA and this codebase's own honest, self-identifying
// COLLECTOR_USER_AGENT pass reliably — so this collector deliberately does NOT override the
// User-Agent to look like a browser, unlike collectors/smartdoko/collector.ts.
const STORE_API_URL = `https://infotechsnepal.com.np/wp-json/wc/store/v1/products?category=${INFOTECHS_LAPTOP_CATEGORY_ID}&per_page=100`;

export const infotechsnepalCollector: StoreCollector = {
  storeId: "infotechsnepal",
  store: {
    name: "Infotechs Nepal",
    slug: "infotechsnepal",
    websiteUrl: "https://infotechsnepal.com.np",
    description: "Nepal online electronics retailer — a large laptop catalog.",
  },
  category: { name: "Laptops", slug: "laptops" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const raw = await fetchText(STORE_API_URL, { headers: { Accept: "application/json" } });
    const items = JSON.parse(raw) as InfotechsProduct[];
    if (!items.length) throw new Error("no laptop products found in Infotechs Nepal's Laptops category");
    const products = parseInfotechsProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(infotechsnepalCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(infotechsnepalCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
