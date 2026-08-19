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
