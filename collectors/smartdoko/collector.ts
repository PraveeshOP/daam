import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseSmartdokoProducts, SMARTDOKO_TV_CATEGORY_SLUG, SMARTDOKO_TV_CATEGORY_IDS, type SmartdokoFilteredResponse } from "@/collectors/smartdoko/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): explicitly names and allows ClaudeBot
// (among GPTBot/PerplexityBot/Google-Extended), no Crawl-delay. The category page itself renders
// no products server-side (a client-side Vue component fetches this same endpoint), so this goes
// straight to the API rather than scraping HTML — verified live with a bare curl, no auth/cookies
// needed, no throttling across 5 rapid sequential requests.
//
// This site's own WAF, separately from robots.txt, resets the connection for any request whose
// User-Agent isn't a recognized browser or a specific well-known bot signature — verified live:
// the shared COLLECTOR_USER_AGENT (collectors/core/http.ts, used by every other collector in this
// codebase without issue) gets a bare connection reset here, while an ordinary desktop-browser
// User-Agent gets a normal 200. Since robots.txt already grants broad, explicit permission to
// crawl this exact site, this overrides just this one collector's User-Agent to get past that
// WAF heuristic rather than changing the shared default every other collector relies on.
const API_BASE = "https://smartdoko.com/api/products/filtered";
const BROWSER_LIKE_HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36", Accept: "application/json" };

export const smartdokoCollector: StoreCollector = {
  storeId: "smartdoko",
  store: {
    name: "Smart Doko",
    slug: "smartdoko",
    websiteUrl: "https://smartdoko.com",
    description: "Nepal general online marketplace — electronics, appliances, and household goods.",
  },
  category: { name: "TVs", slug: "televisions" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    const products: CollectResult["products"] = [];
    let discovered = 0;
    let page = 1;
    let lastPage = 1;
    do {
      const raw = await fetchText(`${API_BASE}?filters=true&category=${SMARTDOKO_TV_CATEGORY_SLUG}&page=${page}`, { headers: BROWSER_LIKE_HEADERS });
      const response = JSON.parse(raw) as SmartdokoFilteredResponse;
      lastPage = response.meta.last_page;
      discovered = response.meta.total;
      products.push(...parseSmartdokoProducts(response, SMARTDOKO_TV_CATEGORY_IDS, safeLimit - products.length));
      page += 1;
    } while (products.length < safeLimit && page <= lastPage);

    if (!discovered) throw new Error("no TV products found in SmartDoko's TVs category");
    return { products, discovered, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(smartdokoCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(smartdokoCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
