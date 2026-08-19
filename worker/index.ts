import { Worker } from "bullmq";
import { processPriceCollectionJob } from "@/worker/processor";
import { PRICE_COLLECTION_QUEUE, getPriceCollectionQueue, type PriceCollectionJobData } from "@/worker/queue";
import { closeRedisConnection, createRedisConnection, getSharedRedisConnection } from "@/worker/redis";
import { scheduleRecurringCollections } from "@/worker/scheduler";
import { log, logError } from "@/worker/logger";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 2);

async function main() {
  // A Worker needs its own dedicated Redis connection (it issues blocking commands); the
  // Queue/scheduler reuse one shared, non-blocking connection instead of opening a new one.
  const workerConnection = createRedisConnection("worker");
  const queue = getPriceCollectionQueue();
  await scheduleRecurringCollections();

  const worker = new Worker<PriceCollectionJobData>(
    PRICE_COLLECTION_QUEUE,
    (job) => processPriceCollectionJob(job, workerConnection),
    { connection: workerConnection, concurrency: CONCURRENCY },
  );

  worker.on("active", (job) => log("job", `${job.data.storeId} active (attempt ${job.attemptsMade + 1})`));
  worker.on("completed", (job, result) => log("job", `${job.data.storeId} completed${result?.skipped ? " (skipped: already running)" : ""}`));
  worker.on("failed", (job, error) => logError("job", `${job?.data.storeId ?? "unknown"} failed: ${error.message}`));
  worker.on("error", (error) => logError("worker", error.message));

  log("worker", `listening on "${PRICE_COLLECTION_QUEUE}" with concurrency ${CONCURRENCY}`);

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    log("worker", `received ${signal}, shutting down gracefully`);
    await worker.close(); // stop accepting new jobs, wait for the active one(s) to finish
    await queue.close();
    await closeRedisConnection(workerConnection);
    await closeRedisConnection(getSharedRedisConnection());
    log("worker", "shutdown complete");
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  logError("worker", `fatal: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
