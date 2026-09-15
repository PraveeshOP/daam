import type { StoreProduct } from "@/collectors/evo/types";

/** A single collector's output before it is matched/persisted. Kept generic so the
 * worker and CLI scripts can treat every store collector the same way. */
export type NormalizedStoreProduct = StoreProduct;

export type CollectResult = {
  products: NormalizedStoreProduct[];
  discovered: number;
  /** Per-URL/per-product parse failures. One broken product must not fail the whole store. */
  errors: { url: string; message: string }[];
};

export type StoreConfig = {
  name: string;
  slug: string;
  websiteUrl: string;
  logoUrl?: string;
  description?: string;
};

/**
 * Common interface every store collector implements. `storeId` is the stable slug
 * used both as the `stores.slug` row and as the BullMQ job's `storeId` payload, so a
 * queue job can be mapped straight back to a collector via the registry.
 */
export interface StoreCollector {
  storeId: string;
  store: StoreConfig;
  category: { name: string; slug: string };
  collect(options?: { limit?: number }): Promise<CollectResult>;
}

/** Condition a marketplace seller declared. Retail `offers` have no equivalent — every offer
 * there is implicitly new — which is one of several reasons the two don't share a table. A
 * collector may narrow to a subset (HamroBazaar's takes "brand_new" only), but the type and the
 * column stay open so that choice is a collector's, not the schema's. */
export type MarketplaceCondition = "brand_new" | "like_new" | "used" | "unknown";

/**
 * One advert on a C2C marketplace (HamroBazaar today). Deliberately *not* a
 * `NormalizedStoreProduct`: it is a single seller's individual item, so it carries a condition
 * and a negotiable flag, and it carries no seller identity at all — see the stripping note in
 * collectors/hamrobazaar/parser.ts.
 */
export type MarketplaceListing = {
  externalId: string;
  title: string;
  brand?: string;
  /** The marketplace's own category label, kept verbatim for filtering/attribution. */
  sourceCategory?: string;
  price: number;
  currency: "NPR";
  condition: MarketplaceCondition;
  negotiable: boolean;
  listingUrl: string;
  imageUrl?: string;
  /** When the seller posted the advert, ISO-8601, if the source states it. */
  postedAt?: string;
};

export type MarketplaceCollectResult = {
  listings: MarketplaceListing[];
  discovered: number;
  /** Entries in the source payload that could not be turned into a listing (unparseable, or no
   * usable price). Reported rather than silently dropped: a sudden jump here is the signal that
   * the source's payload shape has drifted. */
  skipped: number;
  errors: { url: string; message: string }[];
};

/**
 * Parallel to `StoreCollector` for sources that are marketplaces rather than retailers. Kept as
 * a separate interface on purpose: `runStoreCollection` writes offers and price history, and a
 * marketplace source must never reach that code path, so it must not be assignable to it.
 */
export interface MarketplaceCollector {
  sourceId: string;
  source: { name: string; websiteUrl: string; description?: string };
  collect(options?: { limit?: number }): Promise<MarketplaceCollectResult>;
}
