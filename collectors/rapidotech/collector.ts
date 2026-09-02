import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseRapidotechProducts, RAPIDOTECH_SPEAKER_CATEGORY_ID, type RapidotechProduct } from "@/collectors/rapidotech/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): explicitly names and allows ClaudeBot
// (among GPTBot/Google-Extended/Applebot-Extended) — only CCBot/Amazonbot/Bytespider are
// disallowed, the friendliest bot policy of any store this session. No Crawl-delay. Verified live
// no WAF block of any tested User-Agent either.
const STORE_API_URL = `https://rapidotechnepal.com/wp-json/wc/store/v1/products?category=${RAPIDOTECH_SPEAKER_CATEGORY_ID}&per_page=100`;

export const rapidotechCollector: StoreCollector = {
  storeId: "rapidotech",
  store: {
    name: "Rapido Tech Nepal",
    slug: "rapidotech",
    websiteUrl: "https://rapidotechnepal.com",
    description: "Nepal online electronics retailer — mobile, audio, and camera accessories.",
  },
  category: { name: "Audio", slug: "audio" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const raw = await fetchText(STORE_API_URL, { headers: { Accept: "application/json" } });
    const items = JSON.parse(raw) as RapidotechProduct[];
    if (!items.length) throw new Error("no speaker products found in Rapido Tech Nepal's Speakers category");
    const products = parseRapidotechProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(rapidotechCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(rapidotechCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
