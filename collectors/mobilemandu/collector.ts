import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseMobilemanduProduct, parseMobilemanduProductUrls } from "@/collectors/mobilemandu/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector) only disallows /nogooglebot/ and declares
// this sitemap — no CAPTCHA/bot-protection encountered fetching either the sitemap or product
// pages with the shared collector User-Agent.
const PRODUCTS_SITEMAP_URL = "https://mobilemandu.com/sitemaps/products.xml";

export const mobilemanduCollector: StoreCollector = {
  storeId: "mobilemandu",
  store: {
    name: "Mobilemandu",
    slug: "mobilemandu",
    websiteUrl: "https://mobilemandu.com",
    description: "Nepal online electronics retailer — mobiles, laptops, and home appliances.",
  },
  category: { name: "Smartphones", slug: "smartphones" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const sitemap = await fetchText(PRODUCTS_SITEMAP_URL, { headers: { Accept: "application/xml" } });
    const urls = parseMobilemanduProductUrls(sitemap, safeLimit);
    if (!urls.length) throw new Error("no smartphone URLs found in Mobilemandu products sitemap");
    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const url of urls) {
      try {
        products.push(...parseMobilemanduProduct(await fetchText(url), url));
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        // Non-phone products that slipped past the URL-level filter (tablets, earbuds, an
        // unrelated appliance brand sharing a name) are expected, not failures — same treatment
        // as Evo's "missing product JSON-LD" for non-product sitemap entries.
        if (!message.startsWith("missing product JSON-LD") && !message.startsWith("not a phone product")) errors.push({ url, message });
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
  const { summary, durationMs } = await runStoreCollection(mobilemanduCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(mobilemanduCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
