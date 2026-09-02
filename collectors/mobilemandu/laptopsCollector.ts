import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseMobilemanduProduct, parseMobilemanduLaptopUrls, LAPTOP_CATEGORY } from "@/collectors/mobilemandu/parser";

loadEnvConfig(process.cwd());

const PRODUCTS_SITEMAP_URL = "https://mobilemandu.com/sitemaps/products.xml";

/** A second category for a store already in the registry — same site, same generic JSON-LD
 * parser (parseMobilemanduProduct, given "laptops" as the expected category), same store.slug
 * ("mobilemandu") so this feeds the one existing Mobilemandu row. Registered under its own
 * storeId for its own BullMQ job/schedule/lock. */
export const mobilemanduLaptopsCollector: StoreCollector = {
  storeId: "mobilemandu-laptops",
  store: {
    name: "Mobilemandu",
    slug: "mobilemandu",
    websiteUrl: "https://mobilemandu.com",
    description: "Nepal online electronics retailer — mobiles, laptops, and home appliances.",
  },
  category: { name: "Laptops", slug: "laptops" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    const sitemap = await fetchText(PRODUCTS_SITEMAP_URL, { headers: { Accept: "application/xml" } });
    const urls = parseMobilemanduLaptopUrls(sitemap, safeLimit);
    if (!urls.length) throw new Error("no laptop URLs found in Mobilemandu products sitemap");
    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const url of urls) {
      try {
        products.push(...parseMobilemanduProduct(await fetchText(url), url, LAPTOP_CATEGORY));
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        // Non-laptop pages that slipped past the URL-level filter (smartwatches, gaming
        // accessories whose slug happens to mention "laptop") are expected, not failures.
        if (!message.startsWith("missing product JSON-LD") && !message.startsWith("unexpected category")) errors.push({ url, message });
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
  const { summary, durationMs } = await runStoreCollection(mobilemanduLaptopsCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(mobilemanduLaptopsCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
