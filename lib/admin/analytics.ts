import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type TimeRange = "today" | "7d" | "30d" | "90d";

export function rangeSince(range: TimeRange): Date {
  const now = new Date();
  if (range === "today") {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    return midnight;
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export const RANGE_LABELS: Record<TimeRange, string> = { today: "Today", "7d": "7 days", "30d": "30 days", "90d": "90 days" };

async function namesForProducts(productIds: string[]): Promise<Map<string, { name: string; slug: string }>> {
  if (!productIds.length) return new Map();
  const service = createServiceClient();
  const { data } = await service.from("products").select("id, name, slug").in("id", productIds);
  return new Map((data || []).map((row) => [row.id, { name: row.name, slug: row.slug }]));
}

async function namesForStores(storeIds: string[]): Promise<Map<string, string>> {
  if (!storeIds.length) return new Map();
  const service = createServiceClient();
  const { data } = await service.from("stores").select("id, name").in("id", storeIds);
  return new Map((data || []).map((row) => [row.id, row.name]));
}

export type UserMetrics = { totalUsers: number; newUsers: number; activeUsers: number };

export async function getUserMetrics(since: Date): Promise<UserMetrics> {
  const supabase = await createServerSupabaseClient();
  const [{ count: totalUsers }, { count: newUsers }, { data: activeUsers }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
    supabase.rpc("analytics_active_users", { p_since: since.toISOString() }),
  ]);
  return { totalUsers: totalUsers ?? 0, newUsers: newUsers ?? 0, activeUsers: Number(activeUsers ?? 0) };
}

export type SearchMetrics = {
  searchesToday: number;
  searchesThisWeek: number;
  topSearches: { query: string; count: number }[];
  zeroResultSearches: { query: string; count: number }[];
};

export async function getSearchMetrics(since: Date): Promise<SearchMetrics> {
  const supabase = await createServerSupabaseClient();
  const todayStart = rangeSince("today");
  const weekStart = rangeSince("7d");
  const [{ count: searchesToday }, { count: searchesThisWeek }, top, zero] = await Promise.all([
    supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", "search").gte("created_at", todayStart.toISOString()),
    supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", "search").gte("created_at", weekStart.toISOString()),
    supabase.rpc("analytics_top_searches", { p_since: since.toISOString(), p_limit: 10, p_zero_results_only: false }),
    supabase.rpc("analytics_top_searches", { p_since: since.toISOString(), p_limit: 10, p_zero_results_only: true }),
  ]);
  return {
    searchesToday: searchesToday ?? 0,
    searchesThisWeek: searchesThisWeek ?? 0,
    topSearches: (top.data || []).map((row) => ({ query: row.query, count: Number(row.search_count) })),
    zeroResultSearches: (zero.data || []).map((row) => ({ query: row.query, count: Number(row.search_count) })),
  };
}

export type TopProduct = { productId: string; name: string; slug: string; count: number };

export async function getProductMetrics(since: Date, limit = 10): Promise<{ mostViewed: TopProduct[]; mostFavorited: TopProduct[]; mostAlerted: TopProduct[] }> {
  const supabase = await createServerSupabaseClient();
  const [viewed, favorited, alerted] = await Promise.all([
    supabase.rpc("analytics_top_products", { p_since: since.toISOString(), p_event_name: "product_view", p_limit: limit }),
    supabase.rpc("most_favorited_products", { p_limit: limit }),
    supabase.rpc("most_alerted_products", { p_limit: limit }),
  ]);

  const allIds = [...(viewed.data || []).map((r) => r.product_id), ...(favorited.data || []).map((r) => r.product_id), ...(alerted.data || []).map((r) => r.product_id)];
  const names = await namesForProducts([...new Set(allIds)]);
  const withName = (id: string, count: number): TopProduct => ({ productId: id, name: names.get(id)?.name ?? "Unknown product", slug: names.get(id)?.slug ?? "", count });

  return {
    mostViewed: (viewed.data || []).map((row) => withName(row.product_id, Number(row.event_count))),
    mostFavorited: (favorited.data || []).map((row) => withName(row.product_id, Number(row.favorite_count))),
    mostAlerted: (alerted.data || []).map((row) => withName(row.product_id, Number(row.alert_count))),
  };
}

export type TopStore = { storeId: string; name: string; count: number };

export async function getStoreMetrics(since: Date, limit = 10): Promise<{ mostClicked: TopStore[] }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("analytics_top_stores", { p_since: since.toISOString(), p_limit: limit });
  const names = await namesForStores((data || []).map((row) => row.store_id));
  return { mostClicked: (data || []).map((row) => ({ storeId: row.store_id, name: names.get(row.store_id) ?? "Unknown store", count: Number(row.click_count) })) };
}

export type AlertMetrics = { activeAlerts: number; triggeredAlerts: number; triggeredToday: number };

export async function getAlertMetrics(): Promise<AlertMetrics> {
  const supabase = await createServerSupabaseClient();
  const todayStart = rangeSince("today");
  const [{ count: activeAlerts }, { count: triggeredAlerts }, { count: triggeredToday }] = await Promise.all([
    supabase.from("price_alerts").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("price_alerts").select("id", { count: "exact", head: true }).eq("is_active", false).not("triggered_at", "is", null),
    supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", "price_alert_triggered").gte("created_at", todayStart.toISOString()),
  ]);
  return { activeAlerts: activeAlerts ?? 0, triggeredAlerts: triggeredAlerts ?? 0, triggeredToday: triggeredToday ?? 0 };
}

/**
 * §11: aggregate rates over the period, not a true per-session funnel — this app doesn't (and
 * per spec shouldn't) track a session id linking one visitor's search → view → click, so this
 * is presented as "of all views in this period, what fraction were followed by a click", which
 * is honest about what it actually measures rather than implying individual-user attribution.
 */
export type ConversionMetrics = {
  productViews: number;
  storeClicks: number;
  favoritesAdded: number;
  alertsCreated: number;
  storeClickRate: number | null;
  favoriteRate: number | null;
  alertRate: number | null;
};

export async function getConversionMetrics(since: Date): Promise<ConversionMetrics> {
  const supabase = await createServerSupabaseClient();
  const countSince = (eventName: string) =>
    supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", eventName).gte("created_at", since.toISOString());

  const [{ count: productViews }, { count: storeClicks }, { count: favoritesAdded }, { count: alertsCreated }] = await Promise.all([
    countSince("product_view"),
    countSince("store_click"),
    countSince("favorite_added"),
    countSince("price_alert_created"),
  ]);

  const rate = (numerator: number, denominator: number) => (denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null);
  const views = productViews ?? 0;

  return {
    productViews: views,
    storeClicks: storeClicks ?? 0,
    favoritesAdded: favoritesAdded ?? 0,
    alertsCreated: alertsCreated ?? 0,
    storeClickRate: rate(storeClicks ?? 0, views),
    favoriteRate: rate(favoritesAdded ?? 0, views),
    alertRate: rate(alertsCreated ?? 0, views),
  };
}

export type DailyPoint = { day: string; count: number };

export async function getDailySeries(since: Date, eventName: string): Promise<DailyPoint[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("analytics_daily_counts", { p_since: since.toISOString(), p_event_name: eventName });
  return (data || []).map((row) => ({ day: row.day, count: Number(row.event_count) }));
}
