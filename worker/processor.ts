import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import { getCollector } from "@/collectors/registry";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import { acquireStoreLock, releaseStoreLock } from "@/worker/lock";
import { log } from "@/worker/logger";
import type { PriceCollectionJobData } from "@/worker/queue";

const JOB_TIMEOUT_MS = Number(process.env.COLLECTION_JOB_TIMEOUT_MS || 5 * 60_000);
const LOCK_TTL_MS = JOB_TIMEOUT_MS + 60_000;
const DEFAULT_PRODUCT_LIMIT = Number(process.env.COLLECTION_PRODUCT_LIMIT || 20);

export type ProcessorResult = { skipped: true; storeId: string } | { skipped: false; storeId: string; errorCount: number };

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * Job received -> identify store -> run collector -> normalize -> match canonical products ->
 * update offers -> update price history -> complete. `runStoreCollection` (shared with the
 * manual `npm run collect:*` scripts) does normalize/match/update; this wraps it with the
 * per-store lock (section 25) and a hard timeout (section 16) that the queue-only layer owns.
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
    const { summary, durationMs } = await withTimeout(
      runStoreCollection(collector, { limit: DEFAULT_PRODUCT_LIMIT }),
      JOB_TIMEOUT_MS,
      `${storeId} collection timed out after ${Math.round(JOB_TIMEOUT_MS / 1000)}s`,
    );
    console.log(formatSummary(collector.store.name, summary, durationMs, startedAt));
    return { skipped: false, storeId, errorCount: summary.errors.length };
  } finally {
    await releaseStoreLock(redis, storeId, token);
  }
}
