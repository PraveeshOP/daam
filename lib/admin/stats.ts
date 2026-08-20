import { createServiceClient } from "@/lib/supabase/service";

export type DashboardStats = {
  products: number;
  stores: number;
  activeOffers: number;
  users: number;
  activeAlerts: number;
};

/** Every number here is a single `count: "exact", head: true` query (an indexed count, no rows
 * fetched) — cheap even at the 10,000+ products / 100,000+ offers scale the spec calls out. */
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = createServiceClient();
  const [products, stores, activeOffers, users, activeAlerts] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("stores").select("id", { count: "exact", head: true }),
    supabase.from("offers").select("id", { count: "exact", head: true }).eq("availability", "in_stock").eq("is_disabled", false),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("price_alerts").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  return {
    products: products.count ?? 0,
    stores: stores.count ?? 0,
    activeOffers: activeOffers.count ?? 0,
    users: users.count ?? 0,
    activeAlerts: activeAlerts.count ?? 0,
  };
}

export type RecentPriceChange = {
  id: string;
  price: number;
  recordedAt: string;
  productName: string;
  productSlug: string;
  storeName: string | null;
};

export async function getRecentPriceChanges(limit = 8): Promise<RecentPriceChange[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("price_history")
    .select("id, price, recorded_at, products(name, slug), stores(name)")
    .order("recorded_at", { ascending: false })
    .limit(limit);

  type Row = { id: string; price: number | string; recorded_at: string; products: { name: string; slug: string } | null; stores: { name: string } | null };
  return ((data || []) as unknown as Row[])
    .filter((row): row is Row & { products: NonNullable<Row["products"]> } => Boolean(row.products))
    .map((row) => ({
      id: row.id,
      price: Number(row.price),
      recordedAt: row.recorded_at,
      productName: row.products.name,
      productSlug: row.products.slug,
      storeName: row.stores?.name ?? null,
    }));
}
