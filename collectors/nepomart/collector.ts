import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseNepomartProduct, parseNepomartProductUrls } from "@/collectors/nepomart/parser";

loadEnvConfig(process.cwd());

// robots.txt (checked before writing this collector): `Disallow:` (blank — allows everything),
// no Crawl-delay. Verified live no WAF block of any tested User-Agent. Real domain redirects
// nepomart.com -> www.nepomart.com; this collector uses the www host directly.
const SITEMAP_URL = "https://www.nepomart.com/sitemap.xml";

export const nepomartCollector: StoreCollector = {
  storeId: "nepomart",
  store: {
    name: "Nepomart",
    slug: "nepomart",
    websiteUrl: "https://www.nepomart.com",
    description: "Nepal online gadget store — smartwatches and wireless earbuds.",
  },
  category: { name: "Smartwatches", slug: "smartwatches" },
  async collect({ limit = 20 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    const sitemap = await fetchText(SITEMAP_URL, { headers: { Accept: "application/xml" } });
    const urls = parseNepomartProductUrls(sitemap, safeLimit);
    if (!urls.length) throw new Error("no smartwatch/earbuds product URLs found in Nepomart's sitemap");
    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const url of urls) {
      try {
        products.push(...parseNepomartProduct(await fetchText(url), url));
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
  const { summary, durationMs } = await runStoreCollection(nepomartCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(nepomartCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
