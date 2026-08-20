import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listCollectionJobs, groupJobsByStore, type CollectionJobView } from "@/lib/admin/collections";

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
};

/** 4x the collection interval — the same "reasonable stale-data threshold" used for stale
 * offers (lib/admin/dataQuality.ts) applies to deciding a store's health here too. */
export function staleThresholdMs(): number {
  const hours = Number(process.env.COLLECTION_INTERVAL_HOURS || 6);
  return hours * 4 * 60 * 60 * 1000;
}

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
  const [{ data: stores }, jobs] = await Promise.all([
    supabase.from("stores").select("id, name, slug, website_url").order("name"),
    listCollectionJobs(),
  ]);
  if (!stores) return [];

  const jobsByStore = groupJobsByStore(jobs);

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
