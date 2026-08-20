import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listCollectionJobs, groupJobsByStore, type CollectionJobView } from "@/lib/admin/collections";
import { validateAffiliateUrl } from "@/lib/stores/destination";
import { staleThresholdMs } from "@/lib/offers/staleness";

export { staleThresholdMs };

export type StoreHealth = "healthy" | "failing" | "unknown";

export type StoreOverview = {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  productCount: number;
  activeOfferCount: number;
  health: StoreHealth;
  healthScore: number | null;
  lastSuccessfulAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  errorCount: number;
  lastDurationMs: number | null;
  recentJobs: CollectionJobView[];
  affiliateEnabled: boolean;
  partnershipStatus: string;
  affiliateNetwork: string | null;
  affiliateTrackingId: string | null;
  /** §7/§18: how many of this store's offers have a usable/broken/absent affiliate_url, so an
   * admin can spot "enabled but nothing to use" or "has links but disabled" at a glance. */
  affiliateUrlCounts: { valid: number; invalid: number; none: number };
};

export type DerivedHealth = Pick<StoreOverview, "health" | "healthScore" | "lastSuccessfulAt" | "lastAttemptAt" | "lastError" | "errorCount" | "lastDurationMs">;

export function deriveHealth(jobsForStore: CollectionJobView[] | undefined): DerivedHealth {
  if (!jobsForStore?.length) {
    return { health: "unknown", healthScore: null, lastSuccessfulAt: null, lastAttemptAt: null, lastError: null, errorCount: 0, lastDurationMs: null };
  }
  const mostRecent = jobsForStore[0];
  const lastCompleted = jobsForStore.find((job) => job.status === "completed");
  const lastFailed = jobsForStore.find((job) => job.status === "failed");

  const stale = lastCompleted?.completedAt ? Date.now() - new Date(lastCompleted.completedAt).getTime() > staleThresholdMs() : true;
  const health: StoreHealth = mostRecent.status === "failed" || stale ? "failing" : "healthy";

  // §20: a percentage health score — real attempts (completed or failed; "skipped" jobs never
  // ran, so they don't count either way) over the retained history, most recent first.
  const attempts = jobsForStore.filter((job) => job.status === "completed" || job.status === "failed");
  const healthScore = attempts.length ? Math.round((attempts.filter((job) => job.status === "completed").length / attempts.length) * 1000) / 10 : null;

  return {
    health,
    healthScore,
    lastSuccessfulAt: lastCompleted?.completedAt ?? null,
    lastAttemptAt: mostRecent.startedAt ?? mostRecent.completedAt ?? null,
    lastError: lastFailed?.failedReason ?? null,
    errorCount: lastCompleted?.errorCount ?? 0,
    lastDurationMs: lastCompleted?.durationMs ?? null,
  };
}

/**
 * One row per store, joining Supabase counts with BullMQ job history (§6). Each store's product
 * count is "distinct products with an offer from this store" — since offers are unique per
 * (product_id, store_id), counting that store's offer rows already gives that count without a
 * separate distinct query.
 */
export async function listStoreOverviews(): Promise<StoreOverview[]> {
  const supabase = await createServerSupabaseClient();
  const [{ data: stores }, jobs, { data: affiliateUrls }] = await Promise.all([
    supabase
      .from("stores")
      .select("id, name, slug, website_url, affiliate_enabled, partnership_status, affiliate_network, affiliate_tracking_id")
      .order("name"),
    listCollectionJobs(),
    // Only the two columns needed for the per-store affiliate-URL breakdown, not the whole
    // offers table (§25/§29 — offers is expected to reach 100,000+ rows).
    supabase.from("offers").select("store_id, affiliate_url"),
  ]);
  if (!stores) return [];

  const jobsByStore = groupJobsByStore(jobs);
  const urlCountsByStore = new Map<string, { valid: number; invalid: number; none: number }>();
  for (const row of affiliateUrls || []) {
    const counts = urlCountsByStore.get(row.store_id) ?? { valid: 0, invalid: 0, none: 0 };
    counts[validateAffiliateUrl(row.affiliate_url)]++;
    urlCountsByStore.set(row.store_id, counts);
  }

  const overviews = await Promise.all(
    stores.map(async (store) => {
      const [{ count: productCount }, { count: activeOfferCount }] = await Promise.all([
        supabase.from("offers").select("id", { count: "exact", head: true }).eq("store_id", store.id),
        supabase.from("offers").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("availability", "in_stock").eq("is_disabled", false),
      ]);
      const health = deriveHealth(jobsByStore.get(store.slug));
      return {
        id: store.id,
        name: store.name,
        slug: store.slug,
        websiteUrl: store.website_url,
        productCount: productCount ?? 0,
        activeOfferCount: activeOfferCount ?? 0,
        recentJobs: jobsByStore.get(store.slug) ?? [],
        affiliateEnabled: store.affiliate_enabled,
        partnershipStatus: store.partnership_status,
        affiliateNetwork: store.affiliate_network,
        affiliateTrackingId: store.affiliate_tracking_id,
        affiliateUrlCounts: urlCountsByStore.get(store.id) ?? { valid: 0, invalid: 0, none: 0 },
        ...health,
      };
    }),
  );

  return overviews;
}

export async function getStoreOverview(storeId: string): Promise<StoreOverview | null> {
  const overviews = await listStoreOverviews();
  return overviews.find((store) => store.id === storeId) ?? null;
}
