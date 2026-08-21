import { loadEnvConfig } from "@next/env";
import { delay, fetchText } from "@/collectors/core/http";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import type { CollectResult, StoreCollector } from "@/collectors/core/types";
import { extractCategorySlugs, parseItechstoreVariantDetail, dedupeVariantsByTitle, type ItechstoreCategory, type ItechstoreProductDetail } from "@/collectors/itechstore/parser";

loadEnvConfig(process.cwd());

const API_BASE = "https://ibe.itechstore.com.np/api/v2/shop";
// This category (verified live) is 100% Apple — iPhone 13 through 17 Pro Max plus iPad — no
// Android handsets exist anywhere in iTechStore's 15-category taxonomy.
const CATEGORY_SLUG = "phones-tablets-e-reader";

async function fetchDetail(slug: string, variantSlug?: string) {
  const query = variantSlug ? `?variant_slug=${encodeURIComponent(variantSlug)}` : "";
  return JSON.parse(await fetchText(`${API_BASE}/product/${slug}/${query}`, { headers: { Accept: "application/json" } })) as ItechstoreProductDetail;
}

export const itechstoreCollector: StoreCollector = {
  storeId: "itechstore",
  store: {
    name: "iTechStore",
    slug: "itechstore",
    websiteUrl: "https://itechstore.com.np",
    description: "Authorized Apple/HP/Lenovo/Dell/Microsoft distributor in Nepal.",
  },
  category: { name: "Smartphones", slug: "smartphones" },
  async collect({ limit = 15 } = {}): Promise<CollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 30);
    const category = JSON.parse(await fetchText(`${API_BASE}/category/${CATEGORY_SLUG}/`, { headers: { Accept: "application/json" } })) as ItechstoreCategory;
    const slugs = extractCategorySlugs(category, safeLimit);
    if (!slugs.length) throw new Error("no phone product slugs found in iTechStore's phones-tablets-e-reader category");

    const products: CollectResult["products"] = [];
    const errors: CollectResult["errors"] = [];
    for (const slug of slugs) {
      const productUrl = `https://itechstore.com.np/product/${slug}`;
      try {
        const base = await fetchDetail(slug);
        await delay(750);
        const variants = dedupeVariantsByTitle(base.variants || []);
        if (variants.length <= 1) {
          const product = parseItechstoreVariantDetail(base, productUrl);
          if (product) products.push(product);
          continue;
        }
        for (const variant of variants) {
          const detail = await fetchDetail(slug, variant.slug);
          const product = parseItechstoreVariantDetail(detail, productUrl);
          if (product) products.push(product);
          await delay(750);
        }
      } catch (error) {
        errors.push({ url: productUrl, message: error instanceof Error ? error.message : "unknown error" });
      }
    }
    return { products, discovered: slugs.length, errors };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(itechstoreCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 15) });
  console.log(formatSummary(itechstoreCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
