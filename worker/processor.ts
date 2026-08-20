import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import { getCollector } from "@/collectors/registry";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import { acquireStoreLock, releaseStoreLock } from "@/worker/lock";
import { log } from "@/lib/logger";
import type { PriceCollectionJobData } from "@/lib/queue/priceCollection";
import type { CollectionSummary } from "@/collectors/evo/types";
import { withSpan } from "@/lib/otel/tracing";
import { storeCollectionDuration, storeCollectionFailureTotal, storeCollectionSuccessTotal, productsCollectedTotal, productsMatchedTotal, productsCreatedTotal, priceChangesTotal } from "@/lib/otel/metrics";

const JOB_TIMEOUT_MS = Number(process.env.COLLECTION_JOB_TIMEOUT_MS || 5 * 60_000);
const LOCK_TTL_MS = JOB_TIMEOUT_MS + 60_000;
const DEFAULT_PRODUCT_LIMIT = Number(process.env.COLLECTION_PRODUCT_LIMIT || 20);

/**
 * The full summary is kept on the job's return value (not just a pass/fail) so the admin
 * dashboard's Collections page (phase 6) can render "Discovered / Updated / Price changes /
 * Errors" straight from BullMQ's own job history — reusing the existing collector/queue
 * information instead of standing up a second collection-history system.
 */
export type ProcessorResult =
  | { skipped: true; storeId: string }
  | { skipped: false; storeId: string; startedAt: string; durationMs: number; summary: CollectionSummary };

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function recordCollectionMetrics(storeId: string, summary: CollectionSummary, durationMs: number) {
  const attributes = { "pricenepal.store_id": storeId };
  storeCollectionSuccessTotal.add(1, attributes);
  storeCollectionDuration.record(durationMs, attributes);
  productsCollectedTotal.add(summary.discovered, attributes);
  productsMatchedTotal.add(summary.matchedProducts, attributes);
  productsCreatedTotal.add(summary.createdProducts, attributes);
  priceChangesTotal.add(summary.priceChanges, attributes);
}

/**
 * Job received -> identify store -> run collector -> normalize -> match canonical products ->
 * update offers -> update price history -> complete. `runStoreCollection` (shared with the
 * manual `npm run collect:*` scripts) does normalize/match/update; this wraps it with the
 * per-store lock (section 25) and a hard timeout (section 16) that the queue-only layer owns,
 * plus the top-level "collection.job" span/metrics for phase-7 observability.
 */
export async function processPriceCollectionJob(job: Job<PriceCollectionJobData>, redis: Redis): Promise<ProcessorResult> {
  const { storeId } = job.data;
  const collector = getCollector(storeId);
  const startedAt = new Date();

  const token = await acquireStoreLock(redis, storeId, LOCK_TTL_MS);
  if (!token) {
    log("worker", `${storeId} skipped — a collection for this store is already running`);
    return { skipped: true, storeId };
  }

  try {
    return await withSpan("collection.job", { "pricenepal.store_id": storeId, "pricenepal.job_id": job.id ?? "unknown" }, async () => {
      try {
        const { summary, durationMs } = await withTimeout(
          runStoreCollection(collector, { limit: DEFAULT_PRODUCT_LIMIT }),
          JOB_TIMEOUT_MS,
          `${storeId} collection timed out after ${Math.round(JOB_TIMEOUT_MS / 1000)}s`,
        );
        console.log(formatSummary(collector.store.name, summary, durationMs, startedAt));
        recordCollectionMetrics(storeId, summary, durationMs);
        return { skipped: false, storeId, startedAt: startedAt.toISOString(), durationMs, summary };
      } catch (error) {
        storeCollectionFailureTotal.add(1, { "pricenepal.store_id": storeId });
        throw error;
      }
    });
  } finally {
    await releaseStoreLock(redis, storeId, token);
  }
}
