import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseIttiCategoryProduct, parseIttiGamingUrls, GAMING_CANONICAL_URL_HINT, GAMING_NAME_FALLBACK_HINT, type IttiPayload } from "@/collectors/itti/parser";

loadEnvConfig(process.cwd());

const SITEMAP_URL = "https://itti.com.np/sitemap.xml";

async function fetchProduct(url: string) {
  const productPath = new URL(url).pathname.replace(/^\/product\//, "/");
  const endpoint = `https://itti.com.np/api-proxy/product-detail${productPath}?compare_session_id=${crypto.randomUUID()}`;
  return JSON.parse(await fetchText(endpoint, { headers: { Accept: "application/json" } })) as { is_product?: boolean; data?: IttiPayload };
}

/** A third category for a store already in the registry — same site, same product-detail API,
 * same store.slug ("itti"). Fills the Gaming catalog category, which had zero real products
 * before this (verified via a broad Nepal-gaming-store survey: near-zero real console inventory
 * anywhere else checked, but ITTI's own sitemap has real PS5/Xbox/handheld listings). */
export const ittiGamingCollector: StoreCollector = {
  storeId: "itti-gaming",
  store: { name: "ITTI", slug: "itti", websiteUrl: "https://itti.com.np", logoUrl: "https://itti.com.np/logo.webp", description: "ITTI Computer World electronics retailer in Nepal." },
  category: { name: "Gaming", slug: "gaming" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    const urls = parseIttiGamingUrls(await fetchText(SITEMAP_URL, { headers: { Accept: "application/xml" } }), safeLimit);
    if (!urls.length) throw new Error("no gaming console product URLs found in ITTI sitemap");
    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const url of urls) {
      try {
        products.push(...parseIttiCategoryProduct(await fetchProduct(url), url, GAMING_CANONICAL_URL_HINT, GAMING_NAME_FALLBACK_HINT));
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        // Networking switches/accessories that slipped past the URL-level filter are expected,
        // not failures — same treatment as every other collector's non-product/wrong-category skip.
        if (!message.startsWith("missing ITTI product payload") && !message.startsWith("unexpected category")) errors.push({ url, message });
      }
      await delay(750);
    }
    return { products, discovered: urls.length, errors };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(ittiGamingCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(ittiGamingCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
