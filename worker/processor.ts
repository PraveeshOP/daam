import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import { getCollector } from "@/collectors/registry";
import { getMarketplaceCollector, isMarketplaceSource } from "@/collectors/marketplaceRegistry";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import { formatMarketplaceSummary, runMarketplaceCollection, type MarketplaceSummary } from "@/collectors/core/marketplace";
import { acquireStoreLock, releaseStoreLock } from "@/worker/lock";
import { log, logError } from "@/lib/logger";
import type { PriceCollectionJobData } from "@/lib/queue/priceCollection";
import type { CollectionSummary } from "@/collectors/evo/types";
import { withSpan } from "@/lib/otel/tracing";
import { storeCollectionDuration, storeCollectionFailureTotal, storeCollectionSuccessTotal, productsCollectedTotal, productsMatchedTotal, productsCreatedTotal, priceChangesTotal } from "@/lib/otel/metrics";

const DEFAULT_PRODUCT_LIMIT = Number(process.env.COLLECTION_PRODUCT_LIMIT || 20);
// A marketplace run is a single page fetch that yields everything the source server-renders, so
// this is a cap on what one run may store, not a crawl budget like COLLECTION_PRODUCT_LIMIT.
const DEFAULT_MARKETPLACE_LISTING_LIMIT = Number(process.env.MARKETPLACE_LISTING_LIMIT || 100);
const REQUEST_TIMEOUT_MS = Number(process.env.COLLECTOR_REQUEST_TIMEOUT_MS || 15_000);

// §C1-compounding (phase-9 audit): the old fixed 5-minute default didn't scale with
// COLLECTION_PRODUCT_LIMIT/COLLECTOR_REQUEST_TIMEOUT_MS — at their own defaults (20 products,
// 15s/request, plus each collector's own ~750ms inter-item delay) a normal, non-failing run's
// worst case (~315s) was already over the old 300s timeout. Deriving the default from the two
// values that actually determine how long a run can legitimately take keeps them from drifting
// out of sync again; COLLECTION_JOB_TIMEOUT_MS still overrides this outright when set.
const DEFAULT_JOB_TIMEOUT_MS = Math.max(5 * 60_000, DEFAULT_PRODUCT_LIMIT * (REQUEST_TIMEOUT_MS + 2_000) + 60_000);
const JOB_TIMEOUT_MS = Number(process.env.COLLECTION_JOB_TIMEOUT_MS || DEFAULT_JOB_TIMEOUT_MS);
const LOCK_TTL_MS = JOB_TIMEOUT_MS + 60_000;

/**
 * The full summary is kept on the job's return value (not just a pass/fail) so the admin
 * dashboard's Collections page (phase 6) can render "Discovered / Updated / Price changes /
 * Errors" straight from BullMQ's own job history — reusing the existing collector/queue
 * information instead of standing up a second collection-history system.
 */
export type ProcessorResult =
  | { skipped: true; storeId: string }
  | { skipped: false; storeId: string; startedAt: string; durationMs: number; summary: CollectionSummary }
  /** A C2C marketplace run. Tagged so the admin dashboard can tell it apart from a retail
   * collection and label it honestly — its counts mean listings seen, not offers priced. */
  | { skipped: false; marketplace: true; storeId: string; startedAt: string; durationMs: number; marketplaceSummary: MarketplaceSummary };

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
  // Marketplace sources share this queue (and its per-store lock, timeout and retry policy) but
  // deliberately not `runStoreCollection` — they write only `marketplace_listings`, never
  // `offers`/`price_history`. Branching here keeps that one difference explicit instead of
  // hiding it behind a shared interface that would make the wrong wiring type-check.
  if (isMarketplaceSource(storeId)) return processMarketplaceJob(job, redis, storeId);
  const collector = getCollector(storeId);
  const startedAt = new Date();

  const token = await acquireStoreLock(redis, storeId, LOCK_TTL_MS);
  if (!token) {
    log("worker", `${storeId} skipped — a collection for this store is already running`);
    return { skipped: true, storeId };
  }

  // §9.9/C1: `withTimeout` below only stops *waiting* on this promise — it can't cancel
  // `runStoreCollection` itself, which keeps running (and keeps writing offers/price_history)
  // in the background even after the job has been reported as failed. Releasing the store lock
  // as soon as the timeout fires would let a retry (or a manual trigger) start a *second*,
  // concurrent collection for this store while the first one is still writing — exactly what
  // this lock exists to prevent. So the lock is released when the real work actually finishes
  // (success or genuine failure), never when we merely stop waiting for it; `LOCK_TTL_MS`
  // (job timeout + 60s margin) is the backstop if the abandoned run somehow never settles.
  const collectionWork = withSpan("collection.job", { "pricenepal.store_id": storeId, "pricenepal.job_id": job.id ?? "unknown" }, async () => {
    try {
      const { summary, durationMs } = await runStoreCollection(collector, { limit: DEFAULT_PRODUCT_LIMIT });
      console.log(formatSummary(collector.store.name, summary, durationMs, startedAt));
      recordCollectionMetrics(storeId, summary, durationMs);
      return { skipped: false as const, storeId, startedAt: startedAt.toISOString(), durationMs, summary };
    } catch (error) {
      storeCollectionFailureTotal.add(1, { "pricenepal.store_id": storeId });
      throw error;
    }
  });

  collectionWork.then(
    () => releaseStoreLock(redis, storeId, token),
    () => releaseStoreLock(redis, storeId, token),
  ).catch((error) => logError("worker", `${storeId} failed to release store lock after settling: ${error instanceof Error ? error.message : error}`));

  return withTimeout(collectionWork, JOB_TIMEOUT_MS, `${storeId} collection timed out after ${Math.round(JOB_TIMEOUT_MS / 1000)}s`);
}

async function processMarketplaceJob(job: Job<PriceCollectionJobData>, redis: Redis, sourceId: string): Promise<ProcessorResult> {
  const collector = getMarketplaceCollector(sourceId);
  const startedAt = new Date();

  const token = await acquireStoreLock(redis, sourceId, LOCK_TTL_MS);
  if (!token) {
    log("worker", `${sourceId} skipped — a collection for this source is already running`);
    return { skipped: true, storeId: sourceId };
  }

  // Same lock-release discipline as the retail path above: released when the work actually
  // settles, never merely when we stop waiting on it.
  const work = withSpan("collection.job", { "pricenepal.source_id": sourceId, "pricenepal.job_id": job.id ?? "unknown" }, async () => {
    try {
      const { summary, durationMs } = await runMarketplaceCollection(collector, { limit: DEFAULT_MARKETPLACE_LISTING_LIMIT });
      console.log(formatMarketplaceSummary(collector.source.name, summary, durationMs, startedAt));
      storeCollectionSuccessTotal.add(1, { "pricenepal.store_id": sourceId });
      storeCollectionDuration.record(durationMs, { "pricenepal.store_id": sourceId });
      // Only "how many did we see" is comparable with the retail counters. Matched/created/
      // price-change counters are deliberately not incremented: a listing is never matched to a
      // canonical product here and never produces a price-history point, so feeding zeros or
      // fake values into those metrics would misreport both this source and the site totals.
      productsCollectedTotal.add(summary.discovered, { "pricenepal.store_id": sourceId });
      return { skipped: false as const, marketplace: true as const, storeId: sourceId, startedAt: startedAt.toISOString(), durationMs, marketplaceSummary: summary };
    } catch (error) {
      storeCollectionFailureTotal.add(1, { "pricenepal.store_id": sourceId });
      throw error;
    }
  });

  work.then(
    () => releaseStoreLock(redis, sourceId, token),
    () => releaseStoreLock(redis, sourceId, token),
  ).catch((error) => logError("worker", `${sourceId} failed to release lock after settling: ${error instanceof Error ? error.message : error}`));

  return withTimeout(work, JOB_TIMEOUT_MS, `${sourceId} collection timed out after ${Math.round(JOB_TIMEOUT_MS / 1000)}s`);
}
