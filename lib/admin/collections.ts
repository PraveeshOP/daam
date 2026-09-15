import type { Job } from "bullmq";
import { getPriceCollectionQueue } from "@/lib/queue/priceCollection";
import { getCollector } from "@/collectors/registry";
import { MARKETPLACE_COLLECTORS } from "@/collectors/marketplaceRegistry";
import type { ProcessorResult } from "@/worker/processor";
import type { PriceCollectionJobData } from "@/lib/queue/priceCollection";

export type CollectionStatus = "completed" | "skipped" | "failed" | "active" | "waiting" | "delayed";

export type CollectionJobView = {
  id: string;
  storeId: string;
  storeName: string;
  /** Retail collections and C2C marketplace runs share this queue but not their column
   * meanings: a marketplace run has no offers and no price history, so the UI must label the
   * row rather than let a structural zero read as "no price changes were detected". */
  kind: "retail" | "marketplace";
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
  const marketplace = MARKETPLACE_COLLECTORS[storeId];
  if (marketplace) return marketplace.source.name;
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
  const finished = result && !result.skipped ? result : undefined;
  const summary = finished && !("marketplace" in finished) ? finished.summary : undefined;
  const marketplaceSummary = finished && "marketplace" in finished ? finished.marketplaceSummary : undefined;
  const resolvedStatus: CollectionStatus = result?.skipped ? "skipped" : status;

  // A marketplace run's counts are mapped only onto the columns where they mean the same thing:
  // "discovered" is listings seen, and re-seeing a listing is the closest analogue of updating an
  // offer. `createdProducts`/`matchedProducts`/`createdOffers` stay 0 because no canonical
  // product or offer is ever written on that path — see collectors/core/marketplace.ts.
  return {
    id: job.id || "",
    storeId: job.data.storeId,
    storeName: storeName(job.data.storeId),
    kind: marketplaceSummary || job.data.storeId in MARKETPLACE_COLLECTORS ? "marketplace" : "retail",
    status: resolvedStatus,
    startedAt: finished ? finished.startedAt : startedAt,
    completedAt,
    durationMs: finished ? finished.durationMs : job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : null,
    discovered: summary?.discovered ?? marketplaceSummary?.discovered ?? 0,
    createdProducts: summary?.createdProducts ?? 0,
    matchedProducts: summary?.matchedProducts ?? 0,
    createdOffers: summary?.createdOffers ?? 0,
    updatedOffers: summary?.updatedOffers ?? marketplaceSummary?.updated ?? 0,
    priceChanges: summary?.priceChanges ?? 0,
    errorCount: summary?.errors.length ?? marketplaceSummary?.errors.length ?? 0,
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
