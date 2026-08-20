import type { Job } from "bullmq";
import { getPriceCollectionQueue } from "@/lib/queue/priceCollection";
import { getCollector } from "@/collectors/registry";
import type { ProcessorResult } from "@/worker/processor";
import type { PriceCollectionJobData } from "@/lib/queue/priceCollection";

export type CollectionStatus = "completed" | "skipped" | "failed" | "active" | "waiting" | "delayed";

export type CollectionJobView = {
  id: string;
  storeId: string;
  storeName: string;
  status: CollectionStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  discovered: number;
  createdProducts: number;
  matchedProducts: number;
  createdOffers: number;
  updatedOffers: number;
  priceChanges: number;
  errorCount: number;
  failedReason: string | null;
};

function storeName(storeId: string): string {
  try {
    return getCollector(storeId).store.name;
  } catch {
    return storeId;
  }
}

function mapJob(job: Job<PriceCollectionJobData>, status: Exclude<CollectionStatus, "completed" | "skipped">): CollectionJobView;
function mapJob(job: Job<PriceCollectionJobData>, status: "completed"): CollectionJobView;
function mapJob(job: Job<PriceCollectionJobData>, status: CollectionStatus): CollectionJobView {
  const startedAt = job.processedOn ? new Date(job.processedOn).toISOString() : null;
  const completedAt = job.finishedOn ? new Date(job.finishedOn).toISOString() : null;

  const result = status === "completed" ? (job.returnvalue as ProcessorResult | undefined) : undefined;
  const summary = result && !result.skipped ? result.summary : undefined;
  const resolvedStatus: CollectionStatus = result?.skipped ? "skipped" : status;

  return {
    id: job.id || "",
    storeId: job.data.storeId,
    storeName: storeName(job.data.storeId),
    status: resolvedStatus,
    startedAt: result && !result.skipped ? result.startedAt : startedAt,
    completedAt,
    durationMs: result && !result.skipped ? result.durationMs : job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : null,
    discovered: summary?.discovered ?? 0,
    createdProducts: summary?.createdProducts ?? 0,
    matchedProducts: summary?.matchedProducts ?? 0,
    createdOffers: summary?.createdOffers ?? 0,
    updatedOffers: summary?.updatedOffers ?? 0,
    priceChanges: summary?.priceChanges ?? 0,
    errorCount: summary?.errors.length ?? 0,
    failedReason: status === "failed" ? job.failedReason || "Unknown error" : null,
  };
}

/**
 * Reads collection history straight from the existing `price-collection` BullMQ queue instead
 * of a second "collection_runs" table (phase-6 spec §7: "do not create a second collection
 * system"). Retention is bounded by the queue's own `removeOnComplete`/`removeOnFail` options
 * (lib/queue/priceCollection.ts), so fetching everything and sorting in memory is cheap.
 */
export async function listCollectionJobs(): Promise<CollectionJobView[]> {
  const queue = getPriceCollectionQueue();
  const [completed, failed, active, waiting, delayed] = await Promise.all([
    queue.getJobs(["completed"], 0, 200),
    queue.getJobs(["failed"], 0, 200),
    queue.getJobs(["active"], 0, 50),
    queue.getJobs(["waiting"], 0, 50),
    queue.getJobs(["delayed"], 0, 50),
  ]);

  const jobs = [
    ...completed.map((job) => mapJob(job, "completed")),
    ...failed.map((job) => mapJob(job, "failed")),
    ...active.map((job) => mapJob(job, "active")),
    ...waiting.map((job) => mapJob(job, "waiting")),
    ...delayed.map((job) => mapJob(job, "delayed")),
  ];

  return jobs.sort((first, second) => {
    const firstTime = first.startedAt ? new Date(first.startedAt).getTime() : 0;
    const secondTime = second.startedAt ? new Date(second.startedAt).getTime() : 0;
    return secondTime - firstTime;
  });
}

/** Groups the same job list by store — the store detail page, the store list's health badges,
 * and the dashboard all need "what happened most recently for store X" without re-querying. */
export function groupJobsByStore(jobs: CollectionJobView[]): Map<string, CollectionJobView[]> {
  const byStore = new Map<string, CollectionJobView[]>();
  for (const job of jobs) {
    const list = byStore.get(job.storeId);
    if (list) list.push(job);
    else byStore.set(job.storeId, [job]);
  }
  return byStore;
}
