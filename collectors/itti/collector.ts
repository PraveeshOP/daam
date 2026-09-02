import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseIttiProduct, parseIttiProductUrls, type IttiPayload } from "@/collectors/itti/parser";

loadEnvConfig(process.cwd());

const SITEMAP_URL = "https://itti.com.np/sitemap.xml";

async function fetchProduct(url: string) {
  const productPath = new URL(url).pathname.replace(/^\/product\//, "/");
  const endpoint = `https://itti.com.np/api-proxy/product-detail${productPath}?compare_session_id=${crypto.randomUUID()}`;
  return JSON.parse(await fetchText(endpoint, { headers: { Accept: "application/json" } })) as { is_product?: boolean; data?: IttiPayload };
}

export const ittiCollector: StoreCollector = {
  storeId: "itti",
  store: { name: "ITTI", slug: "itti", websiteUrl: "https://itti.com.np", logoUrl: "https://itti.com.np/logo.webp", description: "ITTI Computer World electronics retailer in Nepal." },
  category: { name: "Smartphones", slug: "smartphones" },
  async collect({ limit = 10 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    const urls = parseIttiProductUrls(await fetchText(SITEMAP_URL, { headers: { Accept: "application/xml" } }), safeLimit);
    if (!urls.length) throw new Error("no smartphone product URLs found in ITTI sitemap");
    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const url of urls) {
      try {
        products.push(...parseIttiProduct(await fetchProduct(url), url));
      } catch (error) {
        errors.push({ url, message: error instanceof Error ? error.message : "unknown error" });
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
  const { summary, durationMs } = await runStoreCollection(ittiCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 10) });
  console.log(formatSummary(ittiCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
