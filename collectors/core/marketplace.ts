import { loadEnvConfig } from "@next/env";
import type { MarketplaceCollector, MarketplaceListing } from "@/collectors/core/types";
import { linkMarketplaceListings } from "@/collectors/core/marketplaceLink";
import { createServiceClient, type SupabaseServiceClient } from "@/lib/supabase/service";
import { withSpan } from "@/lib/otel/tracing";

loadEnvConfig(process.cwd());

/**
 * The marketplace equivalent of collectors/core/run.ts — and pointedly not a call into it.
 *
 * A C2C listing cannot go through `importStoreProduct`, for three reasons found while adding
 * HamroBazaar:
 *
 *  1. `offers` is `unique(product_id, store_id)` (supabase/schema.sql). Fifty people each
 *     selling an "iPhone 13 128GB" would collapse into one row, every import overwriting the
 *     last, leaving whichever listing happened to be processed last as "the" price.
 *  2. Used goods sit far below retail. Matched onto a canonical product at the matcher's ≥75%
 *     confidence, a marketplace source becomes permanently the cheapest "store" for everything
 *     it touches, so every comparison on the site would point at it.
 *  3. Listing titles are seller-written free text ("Urgent sales", "Car for sale"). Creating
 *     canonical `products` rows from them pollutes the catalogue irreversibly.
 *
 * So listings are upserted into their own table, keyed by the source's own listing id, and
 * `product_id` stays null: linking a listing to a canonical product is a later, deliberate
 * decision, not something this import path guesses at.
 */
export type MarketplaceSummary = {
  discovered: number;
  created: number;
  updated: number;
  skipped: number;
  /** Listings newly attached to a canonical product this run, so a product page can show them. */
  linked: number;
  errors: { url: string; message: string }[];
};

export type MarketplaceRunOptions = { limit?: number; dryRun?: boolean; client?: SupabaseServiceClient };

function emptySummary(): MarketplaceSummary {
  return { discovered: 0, created: 0, updated: 0, skipped: 0, linked: 0, errors: [] };
}

/** One round-trip to find which of this batch already exist, rather than one per listing. */
async function findExistingIds(client: SupabaseServiceClient, source: string, externalIds: string[]) {
  const existing = new Set<string>();
  const chunkSize = 200;
  for (let index = 0; index < externalIds.length; index += chunkSize) {
    const chunk = externalIds.slice(index, index + chunkSize);
    const { data, error } = await client.from("marketplace_listings").select("external_id").eq("source", source).in("external_id", chunk);
    if (error) throw new Error(`existing listing lookup failed: ${error.message}`);
    for (const row of data || []) existing.add(row.external_id);
  }
  return existing;
}

function toRow(source: string, listing: MarketplaceListing, seenAt: string) {
  return {
    source,
    external_id: listing.externalId,
    title: listing.title,
    brand: listing.brand || null,
    source_category: listing.sourceCategory || null,
    price: listing.price,
    currency: listing.currency,
    condition: listing.condition,
    negotiable: listing.negotiable,
    listing_url: listing.listingUrl,
    image_url: listing.imageUrl || null,
    posted_at: listing.postedAt || null,
    last_seen_at: seenAt,
  };
}

export async function runMarketplaceCollection(collector: MarketplaceCollector, options: MarketplaceRunOptions = {}) {
  const started = Date.now();
  const summary = emptySummary();
  const result = await withSpan("marketplace.collect", { "daam.source_id": collector.sourceId }, () => collector.collect({ limit: options.limit }));
  summary.discovered = result.discovered;
  summary.skipped = result.skipped;
  summary.errors.push(...result.errors);

  if (options.dryRun) return { summary, listings: result.listings, durationMs: Date.now() - started };

  const client = options.client ?? createServiceClient();
  const seenAt = new Date().toISOString();
  const existing = await findExistingIds(client, collector.sourceId, result.listings.map((listing) => listing.externalId));

  await withSpan("marketplace.import", { "daam.source_id": collector.sourceId, "daam.listing_count": result.listings.length }, async () => {
    for (const listing of result.listings) {
      const isNew = !existing.has(listing.externalId);
      // `first_seen_at` is set only on insert and never touched again, so it keeps meaning
      // "when we first saw this advert" across every later re-run that re-observes it.
      const row = isNew ? { ...toRow(collector.sourceId, listing, seenAt), first_seen_at: seenAt } : toRow(collector.sourceId, listing, seenAt);
      const { error } = await client.from("marketplace_listings").upsert(row, { onConflict: "source,external_id" });
      if (error) {
        summary.errors.push({ url: listing.listingUrl, message: error.message });
        continue;
      }
      if (isNew) summary.created += 1;
      else summary.updated += 1;
    }
  });

  // Linking is a separate pass over the stored rows, never part of the upsert loop: it must see
  // everything this run wrote, and a failure to link must not undo listings already saved.
  try {
    const linkSummary = await linkMarketplaceListings(client, collector.sourceId);
    summary.linked = linkSummary.linked;
  } catch (error) {
    summary.errors.push({ url: collector.source.websiteUrl, message: `linking failed: ${error instanceof Error ? error.message : error}` });
  }

  return { summary, listings: result.listings, durationMs: Date.now() - started };
}

export function formatMarketplaceSummary(sourceName: string, summary: MarketplaceSummary, durationMs: number, startedAt: Date) {
  const seconds = Math.round(durationMs / 1000);
  const lines = [
    "daam Marketplace Collection",
    "",
    `Source: ${sourceName}`,
    `Started: ${startedAt.toLocaleTimeString("en-NP", { hour: "2-digit", minute: "2-digit" })}`,
    "",
    `Listings discovered: ${summary.discovered}`,
    `New listings: ${summary.created}`,
    `Re-seen listings: ${summary.updated}`,
    `Skipped (unparseable/no price): ${summary.skipped}`,
    `Linked to a catalogue product: ${summary.linked}`,
    "",
    `Errors: ${summary.errors.length}`,
    "",
    `Duration: ${seconds}s`,
    "",
    "Note: marketplace listings are individual sellers' adverts, not a retailer's catalogue. They",
    "are stored in marketplace_listings and never written to offers or price_history; a linked",
    "listing is shown on its product page, but never triggers a price alert or a history point.",
    "",
    `Status: ${summary.errors.length ? "COMPLETED WITH ERRORS" : "SUCCESS"}`,
  ];
  if (summary.errors.length) {
    lines.push("", "Errors:");
    for (const error of summary.errors) lines.push(`  - ${error.url}: ${error.message}`);
  }
  return lines.join("\n");
}
