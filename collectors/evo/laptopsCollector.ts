import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseProductPage, parseLaptopProductUrls } from "@/collectors/evo/parser";

loadEnvConfig(process.cwd());

const SITEMAP_URL = "https://evostore.com.np/sitemap.xml";

/**
 * A second category for a store already in the registry (§ "add a second category"). Same site,
 * same generic JSON-LD parser (`parseProductPage` — it has no phone-specific logic, so nothing
 * needed to change there), same `stores.slug` ("evo-store") so this feeds the one existing Evo
 * Store row rather than creating a second one — only the URL discovery filter and the target
 * category differ. Registered under its own storeId ("evo-store-laptops") so it gets its own
 * BullMQ job/schedule/lock, independent of the phones collector's.
 */
export const evoLaptopsCollector: StoreCollector = {
  storeId: "evo-store-laptops",
  store: { name: "Evo Store", slug: "evo-store", websiteUrl: "https://evostore.com.np", logoUrl: "https://evostore.com.np/catalog/view/theme/evostore/assets/img/logo/evo-logo-black.svg", description: "Apple Authorized Reseller and Nepal electronics retailer." },
  category: { name: "Laptops", slug: "laptops" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    const sitemap = await fetchText(SITEMAP_URL, { headers: { Accept: "application/xml" } });
    const urls = parseLaptopProductUrls(sitemap, safeLimit);
    if (!urls.length) throw new Error("no MacBook URLs found in Evo sitemap");
    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const url of urls) {
      try {
        const parsed = parseProductPage(await fetchText(url), url);
        // §data-quality: Evo's own SKU for MacBooks doesn't encode screen size — a 13" and 15"
        // Air (or a 14" and 16" Pro with the same chip config) can report the IDENTICAL sku
        // string. importStoreProduct trusts external_id as a stable per-listing identifier and
        // looks it up scoped only by store, so a reused sku would silently overwrite a genuinely
        // different product's offer instead of creating its own (verified live: this actually
        // happened before this fix — two distinct MacBooks merged into one). The product URL
        // path is always unique per listing on this site, so it's used as the external_id here
        // instead of trusting the site's own sku field.
        products.push(...parsed.map((product) => ({ ...product, externalId: new URL(url).pathname.replace(/^\//, "") })));
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        if (!message.startsWith("missing product JSON-LD")) errors.push({ url, message });
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
  const { summary, durationMs } = await runStoreCollection(evoLaptopsCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(evoLaptopsCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
