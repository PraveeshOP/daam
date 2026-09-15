import { findBestMatch, type MatchCandidate } from "@/collectors/core/matcher";
import type { SupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Links stored marketplace listings to canonical products so a product page can show them.
 *
 * This runs as its own pass *after* listings are upserted, deliberately separate from
 * `importStoreProduct`: a listing never creates a product, never writes an offer and never writes
 * a price-history point. It only ever sets `marketplace_listings.product_id` on a row that
 * already exists, or leaves it null.
 *
 * The confidence bar is the same >=75 the retail path treats as certain. That number is only
 * meaningful because the source parser infers a brand from the listing title first — without a
 * brand the matcher tops out at 65 for a *correct* match while still awarding 25 for a bare
 * storage coincidence, so every link would be either absent or wrong. See
 * collectors/hamrobazaar/parser.ts (BRAND_PATTERNS).
 */
export const MARKETPLACE_LINK_CONFIDENCE = 75;

export type LinkSummary = { considered: number; linked: number; unmatched: number };

type ListingRow = { id: string; title: string; brand: string | null; product_id: string | null };

export async function linkMarketplaceListings(client: SupabaseServiceClient, source: string): Promise<LinkSummary> {
  const summary: LinkSummary = { considered: 0, linked: 0, unmatched: 0 };

  // Only unlinked rows. An existing link is left alone: re-running must not silently move a
  // listing onto a different product because the candidate pool shifted between runs.
  const { data: listingRows, error: listingError } = await client
    .from("marketplace_listings")
    .select("id, title, brand, product_id")
    .eq("source", source)
    .is("product_id", null);
  if (listingError) throw new Error(`listing lookup failed: ${listingError.message}`);
  const listings = (listingRows || []) as ListingRow[];
  if (!listings.length) return summary;

  const { data: productRows, error: productError } = await client
    .from("products")
    .select("id, name, brand, specifications")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1000);
  if (productError) throw new Error(`candidate lookup failed: ${productError.message}`);
  const candidates = (productRows || []) as MatchCandidate[];
  if (!candidates.length) return summary;

  for (const listing of listings) {
    summary.considered += 1;
    const match = findBestMatch(
      // A listing has no availability, URL or specs the matcher can use — title, brand and a
      // placeholder price are the whole signal, which is why brand inference carries so much of it.
      { name: listing.title, brand: listing.brand || undefined, price: 1, currency: "NPR", productUrl: "" },
      candidates,
    );
    if (!match.candidate || match.confidence < MARKETPLACE_LINK_CONFIDENCE) {
      summary.unmatched += 1;
      continue;
    }
    const { error } = await client.from("marketplace_listings").update({ product_id: match.candidate.id }).eq("id", listing.id);
    if (error) throw new Error(`listing link failed: ${error.message}`);
    summary.linked += 1;
  }
  return summary;
}
