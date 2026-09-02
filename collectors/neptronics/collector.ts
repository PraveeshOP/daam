import { loadEnvConfig } from "@next/env";
import { fetchAllWooCommerceItems } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseNeptronicsProducts, type NeptronicsProduct } from "@/collectors/neptronics/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector) only disallows /wp-admin/, no bot-specific
// block, no Crawl-delay. Category id 52 ("Speakers & Headphones") is Neptronics' own umbrella
// audio category — verified live to return every wireless-earphone/bluetooth-speaker/headphone
// product on the site (34 total, matching this small store's real audio inventory) via the
// public, unauthenticated WooCommerce Store API — much better than crawling 117 product pages
// one by one for a store this size.
const AUDIO_CATEGORY_ID = 52;
const STORE_API_URL = `https://neptronics.com/wp-json/wc/store/v1/products?category=${AUDIO_CATEGORY_ID}`;

export const neptronicsCollector: StoreCollector = {
  storeId: "neptronics",
  store: {
    name: "Neptronics",
    slug: "neptronics",
    websiteUrl: "https://neptronics.com",
    description: "Nepal online electronics retailer — gaming peripherals, Bluetooth audio, and phone accessories.",
  },
  category: { name: "Audio", slug: "audio" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    // 34 real listings today (verified live) — comfortably under one page, but paginating
    // unconditionally means this keeps fetching everything if the category ever grows past 100.
    const items = await fetchAllWooCommerceItems<NeptronicsProduct>(STORE_API_URL, { maxItems: safeLimit });
    if (!items.length) throw new Error("no audio products found in Neptronics' Speakers & Headphones category");
    const products = parseNeptronicsProducts(items, safeLimit);
    return { products, discovered: items.length, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(neptronicsCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(neptronicsCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
