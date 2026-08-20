import { createServiceClient } from "@/lib/supabase/service";
import { listAdminOffers } from "@/lib/admin/offers";
import { listStoreOverviews } from "@/lib/admin/stores";

export type DataQualityIssue = {
  key: string;
  label: string;
  count: number;
  href: string;
  severity: "warning" | "info";
};

/**
 * The nine categories from phase-6 spec §18. Each count query is a single indexed/bounded
 * lookup (never a full-table scan for the cheap ones); "stale offers" and "duplicate offers"
 * reuse the same bounded, already-sorted scan listAdminOffers uses for its own filtered view
 * (§20: don't add a second way of computing the same thing).
 */
export async function getDataQualityIssues(): Promise<DataQualityIssue[]> {
  const supabase = createServiceClient();

  const [
    missingImages,
    invalidPrices,
    productsWithoutOffers,
    duplicateProducts,
    staleOffers,
    duplicateOffers,
    uncertainMatches,
    stores,
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active").is("image_url", null),
    supabase.from("offers").select("id", { count: "exact", head: true }).lte("price", 0),
    countProductsWithoutOffers(supabase),
    countDuplicateProducts(supabase),
    listAdminOffers("stale", 1),
    listAdminOffers("duplicate_url", 1),
    supabase.from("product_match_candidates").select("id", { count: "exact", head: true }).eq("status", "pending"),
    listStoreOverviews(),
  ]);

  const brokenUrlCount = await countBrokenUrls(supabase);
  const failedStores = stores.filter((store) => store.health === "failing").length;

  return [
    { key: "missing-images", label: "Missing product images", count: missingImages.count ?? 0, href: "/admin/products?issue=missing-image", severity: "warning" },
    { key: "invalid-prices", label: "Missing or invalid prices", count: invalidPrices.count ?? 0, href: "/admin/offers?filter=invalid_price", severity: "warning" },
    { key: "broken-urls", label: "Broken store URLs", count: brokenUrlCount, href: "/admin/offers?filter=all", severity: "warning" },
    { key: "products-without-offers", label: "Products without offers", count: productsWithoutOffers, href: "/admin/products?issue=no-offers", severity: "info" },
    { key: "duplicate-products", label: "Duplicate products", count: duplicateProducts, href: "/admin/matches", severity: "warning" },
    { key: "duplicate-offers", label: "Duplicate offers", count: duplicateOffers.total, href: "/admin/offers?filter=duplicate_url", severity: "warning" },
    { key: "stale-offers", label: "Stale offers", count: staleOffers.total, href: "/admin/offers?filter=stale", severity: "info" },
    { key: "uncertain-matches", label: "Uncertain matches", count: uncertainMatches.count ?? 0, href: "/admin/matches", severity: "warning" },
    { key: "failed-collections", label: "Failed store collections", count: failedStores, href: "/admin/stores", severity: "warning" },
  ];
}

async function countProductsWithoutOffers(supabase: ReturnType<typeof createServiceClient>): Promise<number> {
  // No offers table has a nullable FK back to products to filter on directly, so this reads the
  // (small, already-indexed) set of product ids that DO have an offer and diffs it against the
  // active product count — cheaper than an anti-join for a hand-rolled Database type.
  const [{ count: totalActive }, { data: withOffers }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("offers").select("product_id").limit(50_000),
  ]);
  const distinctWithOffers = new Set((withOffers || []).map((row) => row.product_id)).size;
  return Math.max(0, (totalActive ?? 0) - distinctWithOffers);
}

async function countDuplicateProducts(supabase: ReturnType<typeof createServiceClient>): Promise<number> {
  const { data } = await supabase.from("products").select("brand, name").eq("status", "active").limit(20_000);
  const seen = new Map<string, number>();
  for (const row of data || []) {
    const key = `${row.brand.trim().toLowerCase()}::${row.name.trim().toLowerCase()}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  return [...seen.values()].filter((count) => count > 1).length;
}

async function countBrokenUrls(supabase: ReturnType<typeof createServiceClient>): Promise<number> {
  // Format-only check (§20: never live-request URLs from the dashboard) — empty or non-http(s).
  const { data } = await supabase.from("offers").select("product_url").limit(20_000);
  return (data || []).filter((row) => !row.product_url || !/^https?:\/\//i.test(row.product_url)).length;
}

/**
 * §24: records today's count for each issue, at most once per calendar day — written when an
 * admin actually opens /admin/data-quality, not on a schedule, so this needs no cron job and
 * never grows faster than "days someone looked at this page".
 */
export async function recordDataQualitySnapshots(issues: DataQualityIssue[]): Promise<void> {
  const supabase = createServiceClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existingToday } = await supabase.from("data_quality_snapshots").select("issue_key").gte("created_at", todayStart.toISOString());
  const alreadyRecorded = new Set((existingToday || []).map((row) => row.issue_key));

  const toInsert = issues.filter((issue) => !alreadyRecorded.has(issue.key)).map((issue) => ({ issue_key: issue.key, issue_count: issue.count }));
  if (toInsert.length) await supabase.from("data_quality_snapshots").insert(toInsert);
}

export type IssueTrend = "increasing" | "decreasing" | "stable" | "new";

/**
 * Compares each issue's current count to the closest snapshot at least 7 days old. "new" means
 * there isn't enough history yet to say anything meaningful (nothing recorded before then).
 */
export async function getDataQualityTrends(issues: DataQualityIssue[]): Promise<Record<string, IssueTrend>> {
  const supabase = createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { data } = await supabase
    .from("data_quality_snapshots")
    .select("issue_key, issue_count, created_at")
    .lte("created_at", weekAgo.toISOString())
    .order("created_at", { ascending: false });

  const priorByKey = new Map<string, number>();
  for (const row of data || []) if (!priorByKey.has(row.issue_key)) priorByKey.set(row.issue_key, row.issue_count);

  const trends: Record<string, IssueTrend> = {};
  for (const issue of issues) {
    const prior = priorByKey.get(issue.key);
    if (prior === undefined) trends[issue.key] = "new";
    else if (issue.count > prior) trends[issue.key] = "increasing";
    else if (issue.count < prior) trends[issue.key] = "decreasing";
    else trends[issue.key] = "stable";
  }
  return trends;
}
