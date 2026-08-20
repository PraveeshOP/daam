import { createServiceClient } from "@/lib/supabase/service";
import { listCollectionJobs } from "@/lib/admin/collections";

export type ActivityItem = { id: string; at: string; message: string };

/**
 * A lightweight, synthesized "recent activity" feed (§23) rather than a dedicated events table
 * — it merges the existing BullMQ collection-job history with the admin_audit_logs table
 * (§24), sorted by time. No new event architecture, per the spec's own instruction not to
 * build one.
 */
export async function getRecentActivity(limit = 10): Promise<ActivityItem[]> {
  const [jobs, auditRows] = await Promise.all([
    listCollectionJobs(),
    createServiceClient().from("admin_audit_logs").select("id, action, entity_type, metadata, created_at").order("created_at", { ascending: false }).limit(limit),
  ]);

  const jobItems: ActivityItem[] = jobs
    .filter((job) => job.status === "completed" || job.status === "failed")
    .slice(0, limit)
    .map((job) => ({
      id: `job-${job.id}`,
      at: job.completedAt || job.startedAt || new Date(0).toISOString(),
      message:
        job.status === "failed"
          ? `${job.storeName} collection failed`
          : `${job.storeName} collection completed — ${job.priceChanges} price change${job.priceChanges === 1 ? "" : "s"}${job.createdProducts ? `, ${job.createdProducts} new product${job.createdProducts === 1 ? "" : "s"}` : ""}`,
    }));

  const auditItems: ActivityItem[] = (auditRows.data || []).map((row) => ({
    id: `audit-${row.id}`,
    at: row.created_at,
    message: describeAuditAction(row.action, row.entity_type),
  }));

  return [...jobItems, ...auditItems]
    .sort((first, second) => new Date(second.at).getTime() - new Date(first.at).getTime())
    .slice(0, limit);
}

function describeAuditAction(action: string, entityType: string): string {
  switch (action) {
    case "match.accept":
      return "Admin approved a product match";
    case "match.reject":
      return "Admin kept two products separate";
    case "product.update":
      return "Admin edited a product";
    case "product.disable":
      return "Admin disabled a product";
    case "product.enable":
      return "Admin re-enabled a product";
    case "offer.disable":
      return "Admin disabled an offer";
    case "offer.enable":
      return "Admin re-enabled an offer";
    case "offer.mark_unavailable":
      return "Admin marked an offer unavailable";
    case "collection.trigger":
      return "Admin triggered a manual collection";
    default:
      return `Admin action: ${action} (${entityType})`;
  }
}
