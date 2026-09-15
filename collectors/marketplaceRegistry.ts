import { hamrobazaarCollector } from "@/collectors/hamrobazaar/collector";
import type { MarketplaceCollector } from "@/collectors/core/types";

/**
 * Sibling of collectors/registry.ts for C2C marketplaces, kept as a separate map rather than
 * extra entries in `COLLECTORS`.
 *
 * The separation is load-bearing, not cosmetic: everything that iterates `STORE_IDS` treats its
 * members as retail price-comparison sources, and `getCollector` feeds `runStoreCollection`,
 * which writes `offers` and `price_history`. A marketplace source must never reach that code
 * path (see collectors/core/marketplace.ts for why), and keeping the two registries and the two
 * collector interfaces distinct is what makes that a type error rather than a convention.
 */
export const MARKETPLACE_COLLECTORS: Record<string, MarketplaceCollector> = {
  [hamrobazaarCollector.sourceId]: hamrobazaarCollector,
};

export const MARKETPLACE_SOURCE_IDS = Object.keys(MARKETPLACE_COLLECTORS);

export const isMarketplaceSource = (sourceId: string) => sourceId in MARKETPLACE_COLLECTORS;

export function getMarketplaceCollector(sourceId: string): MarketplaceCollector {
  const collector = MARKETPLACE_COLLECTORS[sourceId];
  if (!collector) throw new Error(`unknown marketplace sourceId "${sourceId}" (known sources: ${MARKETPLACE_SOURCE_IDS.join(", ")})`);
  return collector;
}
