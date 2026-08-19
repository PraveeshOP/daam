import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { ensureCategory, ensureStore, importStoreProduct } from "@/collectors/core/importer";
import type { StoreCollector } from "@/collectors/core/types";
import type { CollectionSummary } from "@/collectors/evo/types";
import type { Database } from "@/types/database";

loadEnvConfig(process.cwd());

export type SupabaseWriteClient = ReturnType<typeof createClient<Database>>;

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
  return { discovered: 0, priceChanges: 0, matchedProducts: 0, createdProducts: 0, createdOffers: 0, updatedOffers: 0, uncertainMatches: [], errors: [] };
}

export function createWriteClient(): SupabaseWriteClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required for writes; use --dry-run to parse without writing.");
  return createClient<Database>(url, serviceKey);
}

/**
 * Runs one store collector end-to-end: fetch + normalize (collector.collect), match against
 * canonical products, and update offers/price history (importStoreProduct). Used by both the
 * manual `npm run collect:*` / `npm run queue:*` scripts and the BullMQ worker so there is a
 * single code path for "how a store gets collected".
 */
export async function runStoreCollection(collector: StoreCollector, options: RunOptions = {}): Promise<RunResult> {
  const started = Date.now();
  const summary = emptySummary();
  const result = await collector.collect({ limit: options.limit });
  summary.discovered = result.discovered;
  summary.errors.push(...result.errors);

  if (options.dryRun) {
    return { summary, durationMs: Date.now() - started };
  }

  const client = options.client ?? createWriteClient();
  const storeId = await ensureStore(client, collector.store);
  const categoryId = await ensureCategory(client, collector.category.name, collector.category.slug);

  for (const product of result.products) {
    try {
      await importStoreProduct(client, product, storeId, categoryId, summary);
    } catch (error) {
      summary.errors.push({ url: product.productUrl, message: error instanceof Error ? error.message : "database error" });
    }
  }

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
  if (summary.errors.length) {
    lines.push("", "Errors:");
    for (const error of summary.errors) lines.push(`  - ${error.url}: ${error.message}`);
  }
  return lines.join("\n");
}
