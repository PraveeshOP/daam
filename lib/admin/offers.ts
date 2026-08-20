import { createServerSupabaseClient } from "@/lib/supabase/server";
import { staleThresholdMs } from "@/lib/admin/stores";

export type OfferFilter = "all" | "stale" | "invalid_price" | "out_of_stock" | "disabled" | "duplicate_url";

export type AdminOfferListItem = {
  id: string;
  productId: string;
  productName: string;
  storeName: string;
  price: number;
  availability: string;
  isDisabled: boolean;
  lastChecked: string;
  productUrl: string;
  isStale: boolean;
};

const PAGE_SIZE = 25;

/**
 * All filtering happens in SQL/JS server-side on a bounded page, never the whole offers table
 * (§25/§29 — this table is expected to reach 100,000+ rows). "Stale" and "duplicate URL" aren't
 * expressible as a single indexed `.eq()`, so those two filters page through a slightly larger
 * candidate window and filter in memory rather than loading everything.
 */
export async function listAdminOffers(filter: OfferFilter, page: number) {
  const supabase = await createServerSupabaseClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const staleBefore = new Date(Date.now() - staleThresholdMs()).toISOString();

  const baseSelect = "id, product_id, price, availability, is_disabled, last_checked, product_url, products(name), stores(name)";

  if (filter === "stale" || filter === "duplicate_url") {
    // These need a wider scan to detect; cap it well below "the whole table" and say so in the UI.
    const { data } = await supabase.from("offers").select(baseSelect).order("last_checked", { ascending: true }).limit(2000);
    const rows = mapRows(data);
    let filtered = rows;
    if (filter === "stale") {
      filtered = rows.filter((row) => row.isStale);
    } else {
      const seen = new Map<string, number>();
      for (const row of rows) seen.set(row.productUrl, (seen.get(row.productUrl) || 0) + 1);
      filtered = rows.filter((row) => (seen.get(row.productUrl) || 0) > 1);
    }
    return { items: filtered.slice(from, to + 1), total: filtered.length, pageSize: PAGE_SIZE, capped: rows.length >= 2000 };
  }

  let query = supabase.from("offers").select(baseSelect, { count: "exact" }).order("last_checked", { ascending: false }).range(from, to);
  if (filter === "invalid_price") query = query.lte("price", 0);
  else if (filter === "out_of_stock") query = query.eq("availability", "out_of_stock");
  else if (filter === "disabled") query = query.eq("is_disabled", true);

  const { data, count } = await query;
  return { items: mapRows(data), total: count ?? 0, pageSize: PAGE_SIZE, capped: false };
}

function mapRows(data: unknown): AdminOfferListItem[] {
  type Row = {
    id: string; product_id: string; price: number | string; availability: string; is_disabled: boolean;
    last_checked: string; product_url: string; products: { name: string } | null; stores: { name: string } | null;
  };
  const staleCutoff = Date.now() - staleThresholdMs();
  return ((data || []) as Row[]).map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: row.products?.name || "Unknown product",
    storeName: row.stores?.name || "Unknown store",
    price: Number(row.price),
    availability: row.availability,
    isDisabled: row.is_disabled,
    lastChecked: row.last_checked,
    productUrl: row.product_url,
    isStale: new Date(row.last_checked).getTime() < staleCutoff,
  }));
}
