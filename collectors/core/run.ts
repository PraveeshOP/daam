import { loadEnvConfig } from "@next/env";
import { ensureCategory, ensureStore, importStoreProduct, type ExistingProduct } from "@/collectors/core/importer";
import type { StoreCollector } from "@/collectors/core/types";
import type { CollectionSummary } from "@/collectors/evo/types";
import { createServiceClient, type SupabaseServiceClient } from "@/lib/supabase/service";
import { withSpan } from "@/lib/otel/tracing";

loadEnvConfig(process.cwd());

export type SupabaseWriteClient = SupabaseServiceClient;

export type RunOptions = {
  limit?: number;
  dryRun?: boolean;
  client?: SupabaseWriteClient;
};

export type RunResult = {
  summary: CollectionSummary;
  durationMs: number;
};

function emptySummary(): CollectionSummary {
  return { discovered: 0, priceChanges: 0, matchedProducts: 0, createdProducts: 0, createdOffers: 0, updatedOffers: 0, uncertainMatches: [], errors: [], priceAnomalies: [] };
}

/** @deprecated use createServiceClient from lib/supabase/service.ts — kept as an alias so
 * existing imports of this name keep working. */
export const createWriteClient = createServiceClient;

/**
 * Runs one store collector end-to-end: fetch + normalize (collector.collect), match against
 * canonical products, and update offers/price history (importStoreProduct). Used by both the
 * manual `npm run collect:*` / `npm run queue:*` scripts and the BullMQ worker so there is a
 * single code path for "how a store gets collected".
 */
export async function runStoreCollection(collector: StoreCollector, options: RunOptions = {}): Promise<RunResult> {
  const started = Date.now();
  const summary = emptySummary();
  // These two spans are no-ops unless a tracer provider is registered (see lib/otel/worker.ts),
  // so they're safe to leave in place for the manual `npm run collect:*` CLI scripts too.
  const result = await withSpan("collection.collect", { "pricenepal.store_id": collector.storeId }, () => collector.collect({ limit: options.limit }));
  summary.discovered = result.discovered;
  summary.errors.push(...result.errors);

  if (options.dryRun) {
    return { summary, durationMs: Date.now() - started };
  }

  const client = options.client ?? createWriteClient();
  const storeId = await ensureStore(client, collector.store);
  const categoryId = await ensureCategory(client, collector.category.name, collector.category.slug);

  // §H2 (phase-9 audit): fetched once per collection run, not once per discovered product —
  // the old per-item query capped at 1000 rows with no `order by`, so once the catalog grew
  // past that cap the matcher's candidate pool became both non-deterministic *and* wasteful
  // (re-fetched from scratch for every single item). Ordering by `created_at` keeps the cap
  // deterministic in the meantime; if the catalog genuinely outgrows 1000 products this should
  // become a narrower server-side candidate query (e.g. by brand) rather than a wider client-side
  // scan.
  const { data: existingRows, error: candidateError } = await client.from("products").select("id, name, brand, specifications").order("created_at", { ascending: true }).limit(1000);
  if (candidateError) throw new Error(`candidate lookup failed: ${candidateError.message}`);
  const existingProducts = (existingRows || []) as ExistingProduct[];

  await withSpan("collection.import", { "pricenepal.store_id": collector.storeId, "pricenepal.product_count": result.products.length }, async () => {
    for (const product of result.products) {
      try {
        await withSpan("collection.import_product", { "pricenepal.store_id": collector.storeId, "pricenepal.product_name": product.name }, () =>
          importStoreProduct(client, product, storeId, categoryId, summary, existingProducts),
        );
        // A newly created product this run is itself a valid match candidate for the *next*
        // product in this same batch (two near-identical listings discovered in one run).
      } catch (error) {
        summary.errors.push({ url: product.productUrl, message: error instanceof Error ? error.message : "database error" });
      }
    }
  });

  return { summary, durationMs: Date.now() - started };
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/** Matches the "Collection Summary" shape called for in the phase-4 spec. */
export function formatSummary(storeName: string, summary: CollectionSummary, durationMs: number, startedAt: Date) {
  const lines = [
    "PriceNepal Store Collection",
    "",
    `Store: ${storeName}`,
    `Started: ${startedAt.toLocaleTimeString("en-NP", { hour: "2-digit", minute: "2-digit" })}`,
    "",
    `Products discovered: ${summary.discovered}`,
    `Products processed: ${summary.discovered - summary.errors.length}`,
    "",
    `Matched existing products: ${summary.matchedProducts}`,
    `New products: ${summary.createdProducts}`,
    "",
    `Offers created: ${summary.createdOffers}`,
    `Offers updated: ${summary.updatedOffers}`,
    "",
    `Prices changed: ${summary.priceChanges}`,
    "",
    `Errors: ${summary.errors.length}`,
    "",
    `Duration: ${formatDuration(durationMs)}`,
    "",
    `Status: ${summary.errors.length ? "COMPLETED WITH ERRORS" : "SUCCESS"}`,
  ];
  if (summary.uncertainMatches.length) {
    lines.push("", "Uncertain matches:");
    for (const match of summary.uncertainMatches) lines.push(`  ? ${match.name} -> ${match.candidate} (${match.confidence}%)`);
  }
  if (summary.priceAnomalies.length) {
    lines.push("", "Suspicious price changes (written, but worth a manual look):");
    for (const anomaly of summary.priceAnomalies) lines.push(`  ! ${anomaly.name}: NPR ${anomaly.oldPrice} -> NPR ${anomaly.newPrice}`);
  }
  if (summary.errors.length) {
    lines.push("", "Errors:");
    for (const error of summary.errors) lines.push(`  - ${error.url}: ${error.message}`);
  }
  return lines.join("\n");
}
