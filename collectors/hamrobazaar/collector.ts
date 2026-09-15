import { loadEnvConfig } from "@next/env";
import { fetchText } from "@/collectors/core/http";
import { formatMarketplaceSummary, runMarketplaceCollection } from "@/collectors/core/marketplace";
import type { MarketplaceCollectResult, MarketplaceCollector, MarketplaceCondition } from "@/collectors/core/types";
import { HAMROBAZAAR_ORIGIN, parseHamrobazaarListings } from "@/collectors/hamrobazaar/parser";

loadEnvConfig(process.cwd());

/**
 * The homepage feed is chronological across every category on the site, so a single fetch
 * includes plenty this project has no use for (Cars was 30 of 80 in the sample run, alongside
 * For Rent - House, Pet - Dogs and Men's Grooming Tools). These are the consumer-electronics
 * category labels observed live, matched against the site's own `categoryName` verbatim.
 * Everything else is dropped at parse time.
 */
export const HAMROBAZAAR_ELECTRONICS_CATEGORIES = [
  "Mobile Phone Handsets",
  "Laptops",
  "Laptop Accessories",
  "Desktop Accessories",
  "Storage & Optical Drives",
  "Televisions",
  "Video Players",
  "Headphones & Earphones - Wireless",
  "Portable Bluetooth Speakers",
  "Digital Camera Accessories and Parts",
  "DIY & Hobby Electronics",
];

/**
 * Only sealed stock is collected. A useful share of this site's electronics listings are small
 * resellers using it as a storefront rather than individuals clearing out a drawer — 11 of the 13
 * electronics listings in one sampled run were `brand_new` (MacBook Pro M5, iPhone 17, JBL Clip 5
 * and similar), which is the half of the feed that is comparable with retail catalogue prices.
 *
 * `like_new` is deliberately NOT in this list. Despite the name it is the site's condition 2,
 * which is second-hand-but-good, not sealed — it renders as the badge "Like New" next to "Brand
 * New" and "Used", so including it here would quietly re-admit used goods.
 */
export const HAMROBAZAAR_WANTED_CONDITIONS: MarketplaceCondition[] = ["brand_new"];

export const hamrobazaarCollector: MarketplaceCollector = {
  sourceId: "hamrobazaar",
  source: {
    name: "HamroBazaar",
    websiteUrl: HAMROBAZAAR_ORIGIN,
    description: "Nepal's largest C2C marketplace — brand-new/sealed electronics listings from resellers.",
  },
  async collect({ limit = 100 } = {}): Promise<MarketplaceCollectResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    // One request per run, to the site root. There is no page 2 to walk: the compliant surface
    // is exactly what the homepage server-renders (see the robots.txt note in parser.ts), and
    // coverage is meant to accumulate over repeated scheduled runs instead.
    const html = await fetchText(HAMROBAZAAR_ORIGIN, { headers: { Accept: "text/html" } });
    const { listings, skipped } = parseHamrobazaarListings(html, { categories: HAMROBAZAAR_ELECTRONICS_CATEGORIES, conditions: HAMROBAZAAR_WANTED_CONDITIONS });
    if (!skipped && !listings.length) {
      // Nothing parsed *and* nothing rejected means the flight-payload shape moved under us —
      // a genuine breakage, not just a feed that happens to be all cars right now.
      throw new Error("no listings found in HamroBazaar homepage payload — the RSC flight format has likely changed");
    }
    return { listings: listings.slice(0, safeLimit), discovered: listings.length, skipped, errors: [] };
  },
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, listings, durationMs } = await runMarketplaceCollection(hamrobazaarCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 100) });
  console.log(formatMarketplaceSummary(hamrobazaarCollector.source.name, summary, durationMs, startedAt));
  if (dryRun) {
    console.log("\nDry run — nothing written. Listings:");
    for (const listing of listings) console.log(`  ${listing.condition.padEnd(10)} NPR ${String(listing.price).padStart(10)}  ${listing.sourceCategory} — ${listing.title}`);
  }
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
