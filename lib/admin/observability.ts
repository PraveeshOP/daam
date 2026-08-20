import { getPriceCollectionQueue } from "@/lib/queue/priceCollection";
import { getNotificationsQueue } from "@/lib/queue/notifications";
import { listCollectionJobs, groupJobsByStore, type CollectionJobView } from "@/lib/admin/collections";
import { listStoreOverviews } from "@/lib/admin/stores";

export type QueueStats = {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  oldestWaitingAgeMs: number | null;
  avgProcessingMs: number | null;
  recentFailures: { jobId: string; reason: string; failedAt: string | null }[];
};

/** §21: BullMQ queue depth + health, admin-only (never exposes raw Redis to normal users —
 * this whole module is only reachable through /admin/observability, gated the same way as
 * every other admin page/action). */
export async function getQueueStats(): Promise<QueueStats[]> {
  const priceQueue = getPriceCollectionQueue();
  const notificationsQueue = getNotificationsQueue();

  const stats = await Promise.all(
    [
      { name: "price-collection", queue: priceQueue },
      { name: "notifications", queue: notificationsQueue },
    ].map(async ({ name, queue }) => {
      const [counts, waitingJobs, failedJobs, completedJobs] = await Promise.all([
        queue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
        queue.getJobs(["waiting"], 0, 50),
        queue.getJobs(["failed"], 0, 10),
        queue.getJobs(["completed"], 0, 50),
      ]);

      const oldestWaiting = waitingJobs.reduce<number | null>((oldest, job) => {
        if (!job.timestamp) return oldest;
        return oldest === null ? job.timestamp : Math.min(oldest, job.timestamp);
      }, null);

      const durations = completedJobs.map((job) => (job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : null)).filter((value): value is number => value !== null);

      return {
        queueName: name,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        oldestWaitingAgeMs: oldestWaiting !== null ? Date.now() - oldestWaiting : null,
        avgProcessingMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
        recentFailures: failedJobs.map((job) => ({ jobId: job.id || "unknown", reason: job.failedReason || "Unknown error", failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null })),
      };
    }),
  );

  return stats;
}

export type SystemAlert = { severity: "warning" | "critical"; message: string };

/**
 * §23: "start with logging/admin visibility" — these are computed on read, not a background
 * job, and shown as a plain list on /admin/observability. No paging/incident-management system.
 */
export async function getSystemAlerts(): Promise<SystemAlert[]> {
  const [stores, queueStats] = await Promise.all([listStoreOverviews(), getQueueStats()]);
  const alerts: SystemAlert[] = [];

  for (const store of stores) {
    const recentAttempts = store.recentJobs.filter((job) => job.status === "completed" || job.status === "failed").slice(0, 3);
    if (recentAttempts.length >= 3 && recentAttempts.every((job) => job.status === "failed")) {
      alerts.push({ severity: "critical", message: `${store.name} has failed its last ${recentAttempts.length} collection attempts in a row.` });
    } else if (store.health === "failing" && store.lastSuccessfulAt) {
      const hoursStale = Math.round((Date.now() - new Date(store.lastSuccessfulAt).getTime()) / (60 * 60 * 1000));
      alerts.push({ severity: "warning", message: `${store.name}'s data has not updated in over ${hoursStale}h.` });
    } else if (store.health === "failing") {
      alerts.push({ severity: "warning", message: `${store.name} is failing and has never completed a collection yet.` });
    }
  }

  for (const queue of queueStats) {
    if (queue.failed >= 20) alerts.push({ severity: "critical", message: `"${queue.queueName}" has ${queue.failed} failed jobs.` });
    else if (queue.failed >= 5) alerts.push({ severity: "warning", message: `"${queue.queueName}" has ${queue.failed} failed jobs.` });
  }

  return alerts;
}

export function summarizeErrors(jobs: CollectionJobView[], limit = 20) {
  return jobs
    .filter((job) => job.status === "failed" || job.errorCount > 0)
    .slice(0, limit)
    .map((job) => ({
      jobId: job.id,
      storeName: job.storeName,
      durationMs: job.durationMs,
      at: job.completedAt ?? job.startedAt,
      message: job.status === "failed" ? job.failedReason ?? "Unknown error" : `${job.errorCount} product${job.errorCount === 1 ? "" : "s"} failed to import`,
    }));
}

export { listCollectionJobs, groupJobsByStore };
