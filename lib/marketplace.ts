import { supabase } from "@/lib/data";

/**
 * Read layer for `marketplace_listings`. Kept out of lib/data.ts on purpose: everything there
 * feeds the retail price-comparison model (products, offers, lowest price, savings, price
 * history), and marketplace listings must not be mixed into any of those. Nothing in this file
 * touches `offers` or `price_history`.
 */
export type MarketplaceListingView = {
  id: string;
  source: string;
  externalId: string;
  title: string;
  brand: string | null;
  sourceCategory: string | null;
  price: number;
  currency: string;
  condition: string;
  negotiable: boolean;
  listingUrl: string;
  imageUrl: string | null;
  postedAt: string | null;
  lastSeenAt: string;
};

/** Display name per source slug. A marketplace is not a row in `stores`, so there is no join to
 * get this from — see the migration for why that separation exists. */
const SOURCE_NAMES: Record<string, string> = { hamrobazaar: "HamroBazaar" };

export const marketplaceSourceName = (source: string) => SOURCE_NAMES[source] ?? source;

export const CONDITION_LABELS: Record<string, string> = {
  brand_new: "Brand new",
  like_new: "Like new",
  used: "Used",
  unknown: "Unspecified",
};

type Row = {
  id: string; source: string; external_id: string; title: string; brand: string | null;
  source_category: string | null; price: number | string; currency: string; condition: string;
  negotiable: boolean; listing_url: string; image_url: string | null; posted_at: string | null;
  last_seen_at: string;
};

const mapRow = (row: Row): MarketplaceListingView => ({
  id: row.id,
  source: row.source,
  externalId: row.external_id,
  title: row.title,
  brand: row.brand,
  sourceCategory: row.source_category,
  // `price` is numeric(12,2); PostgREST returns it as a string in some configurations, so it is
  // coerced here rather than trusted to arrive as a number.
  price: Number(row.price),
  currency: row.currency,
  condition: row.condition,
  negotiable: row.negotiable,
  listingUrl: row.listing_url,
  imageUrl: row.image_url,
  postedAt: row.posted_at,
  lastSeenAt: row.last_seen_at,
});

const SELECT = "id, source, external_id, title, brand, source_category, price, currency, condition, negotiable, listing_url, image_url, posted_at, last_seen_at";

export type MarketplaceFilters = { category?: string; query?: string };

/**
 * Most recently seen first. There is no pagination yet because a run stores at most
 * MARKETPLACE_LISTING_LIMIT (default 100) listings per source; add one before that stops being
 * true rather than raising this cap.
 */
export async function getMarketplaceListings(filters: MarketplaceFilters = {}, limit = 200): Promise<MarketplaceListingView[]> {
  if (!supabase) return [];
  let request = supabase.from("marketplace_listings").select(SELECT).order("last_seen_at", { ascending: false }).limit(limit);
  if (filters.category) request = request.eq("source_category", filters.category);
  if (filters.query) request = request.ilike("title", `%${filters.query}%`);
  const { data, error } = await request;
  if (error || !data) return [];
  return (data as unknown as Row[]).map(mapRow);
}

/** Busiest category first, then alphabetically so equal counts render in a stable order rather
 * than whatever order the rows happened to arrive in. Rows with no category are omitted: a chip
 * with a blank label would filter to nothing a user could interpret. */
export function tallyCategories(rows: { source_category: string | null }[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.source_category) continue;
    counts.set(row.source_category, (counts.get(row.source_category) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));
}

/** Category labels present in the stored data, for the filter chips. Derived from the rows
 * themselves rather than from the collector's constant, so the UI can never offer a filter that
 * would return nothing. */
export async function getMarketplaceCategories(): Promise<{ name: string; count: number }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("marketplace_listings").select("source_category").limit(1000);
  if (error || !data) return [];
  return tallyCategories(data as { source_category: string | null }[]);
}
