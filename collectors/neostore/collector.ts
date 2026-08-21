import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { parseNeostoreProduct, parseNeostoreProductLinks } from "@/collectors/neostore/parser";

loadEnvConfig(process.cwd());

// No sitemap exists for this site (verified live) — product discovery goes through these
// specific brand/type category pages instead. Its dedicated "cameras" category page turned out
// to redirect to the homepage (empty), and its "Canon" brand page is entirely printers — these
// two are the categories that actually contain real standalone cameras (security/IP cameras),
// verified by checking the JSON absent... i.e. by fetching real product pages first.
const CATEGORY_PAGES = [
  "https://www.neostore.com.np/product-category/home-security-camera",
  "https://www.neostore.com.np/product-category/webcams",
];

// This site's own robots.txt requests "Crawl-delay: 10" explicitly — unlike Evo/ITTI/Mobilemandu,
// which don't specify one (where the existing 750ms default applies) — so this collector honors
// that specific, stated request rather than reusing the shorter default.
const NEOSTORE_DELAY_MS = 10_000;

export const neostoreCollector: StoreCollector = {
  storeId: "neostore",
  store: {
    name: "Neostore",
    slug: "neostore",
    websiteUrl: "https://www.neostore.com.np",
    description: "Nepal online electronics retailer — gadgets, computers, and home appliances.",
  },
  category: { name: "Cameras", slug: "cameras" },
  async collect({ limit = 15 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 30);
    const productUrls: string[] = [];
    for (const categoryUrl of CATEGORY_PAGES) {
      const html = await fetchText(categoryUrl, { headers: { Accept: "text/html" } });
      productUrls.push(...parseNeostoreProductLinks(html, safeLimit));
      await delay(NEOSTORE_DELAY_MS);
    }
    const urls = [...new Set(productUrls)].slice(0, safeLimit);
    if (!urls.length) throw new Error("no camera product URLs found on Neostore's camera category pages");

    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const url of urls) {
      try {
        products.push(...parseNeostoreProduct(await fetchText(url), url));
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        errors.push({ url, message });
      }
      await delay(NEOSTORE_DELAY_MS);
    }
    return { products, discovered: urls.length, errors };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(neostoreCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 15) });
  console.log(formatSummary(neostoreCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
