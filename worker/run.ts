import { Worker } from "bullmq";
import { shutdownWorkerTelemetry } from "@/lib/otel/worker";
import { processPriceCollectionJob } from "@/worker/processor";
import { PRICE_COLLECTION_QUEUE, getPriceCollectionQueue, type PriceCollectionJobData } from "@/lib/queue/priceCollection";
import { processNotificationJob, releaseFailedNotification } from "@/worker/notificationProcessor";
import { NOTIFICATIONS_QUEUE, getNotificationsQueue, type NotificationJobData } from "@/lib/queue/notifications";
import { closeRedisConnection, createRedisConnection, getSharedRedisConnection } from "@/lib/queue/redis";
import { scheduleRecurringCollections } from "@/worker/scheduler";
import { log, logError } from "@/lib/logger";
import { bullmqJobsCompletedTotal, bullmqJobsFailedTotal, notificationFailedTotal } from "@/lib/otel/metrics";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 2);
const NOTIFICATION_CONCURRENCY = Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 5);

/**
 * The actual worker logic — kept out of worker/index.ts and reached only via a dynamic
 * `import()` there. That's not stylistic: every module this file imports eventually imports
 * lib/otel/metrics.ts, whose `meter.createCounter(...)` calls must run *after*
 * `startWorkerTelemetry()` has registered the real MeterProvider or they permanently bind to
 * the no-op one — unlike spans (whose ProxyTracer re-resolves the active provider on every
 * `startSpan()` call), created metric instruments do not. A dynamic import is the only way to
 * guarantee that ordering, since static imports are all hoisted and resolved before any of
 * index.ts's own top-level code (including calling startWorkerTelemetry()) runs.
 */
export async function runWorker() {
  // Each Worker needs its own dedicated Redis connection (it issues blocking commands); Queues
  // reuse one shared, non-blocking connection instead of opening a new one per queue.
  const collectionConnection = createRedisConnection("worker-collection");
  const notificationConnection = createRedisConnection("worker-notifications");
  const priceCollectionQueue = getPriceCollectionQueue();
  const notificationsQueue = getNotificationsQueue();
  await scheduleRecurringCollections();

  const priceWorker = new Worker<PriceCollectionJobData>(
    PRICE_COLLECTION_QUEUE,
    (job) => processPriceCollectionJob(job, collectionConnection),
    { connection: collectionConnection, concurrency: CONCURRENCY },
  );

  priceWorker.on("active", (job) => log("job", `${job.data.storeId} active (attempt ${job.attemptsMade + 1})`));
  priceWorker.on("completed", (job, result) => {
    log("job", `${job.data.storeId} completed${result?.skipped ? " (skipped: already running)" : ""}`);
    bullmqJobsCompletedTotal.add(1, { "pricenepal.queue": PRICE_COLLECTION_QUEUE });
  });
  priceWorker.on("failed", (job, error) => {
    logError("job", `${job?.data.storeId ?? "unknown"} failed: ${error.message}`);
    bullmqJobsFailedTotal.add(1, { "pricenepal.queue": PRICE_COLLECTION_QUEUE });
  });
  priceWorker.on("error", (error) => logError("worker", error.message));

  // Kept as a separate BullMQ Worker (not a separate process — see spec section 20's "do not
  // create unnecessary microservices") so a slow/failing email provider never delays price
  // collection, while both still share this one worker process's lifecycle and shutdown path.
  const notificationWorker = new Worker<NotificationJobData>(
    NOTIFICATIONS_QUEUE,
    (job) => processNotificationJob(job),
    { connection: notificationConnection, concurrency: NOTIFICATION_CONCURRENCY },
  );

  notificationWorker.on("active", (job) => log("notification-job", `alert ${job.data.alertId} active (attempt ${job.attemptsMade + 1})`));
  notificationWorker.on("completed", (job) => {
    log("notification-job", `alert ${job.data.alertId} completed`);
    bullmqJobsCompletedTotal.add(1, { "pricenepal.queue": NOTIFICATIONS_QUEUE });
  });
  notificationWorker.on("failed", (job, error) => {
    logError("notification-job", `alert ${job?.data.alertId ?? "unknown"} failed: ${error.message}`);
    bullmqJobsFailedTotal.add(1, { "pricenepal.queue": NOTIFICATIONS_QUEUE });
    notificationFailedTotal.add(1);
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (exhausted) {
      log("notification-job", `alert ${job.data.alertId} exhausted all retries, releasing claim for a future attempt`);
      releaseFailedNotification(job.data.alertId).catch((releaseError) =>
        logError("notification-job", `could not release alert ${job.data.alertId}: ${releaseError instanceof Error ? releaseError.message : releaseError}`),
      );
    }
  });
  notificationWorker.on("error", (error) => logError("notification-worker", error.message));

  log("worker", `listening on "${PRICE_COLLECTION_QUEUE}" (concurrency ${CONCURRENCY}) and "${NOTIFICATIONS_QUEUE}" (concurrency ${NOTIFICATION_CONCURRENCY})`);

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    log("worker", `received ${signal}, shutting down gracefully`);
    await Promise.all([priceWorker.close(), notificationWorker.close()]); // stop accepting new jobs, wait for active ones to finish
    await Promise.all([priceCollectionQueue.close(), notificationsQueue.close()]);
    await Promise.all([closeRedisConnection(collectionConnection), closeRedisConnection(notificationConnection), closeRedisConnection(getSharedRedisConnection())]);
    await shutdownWorkerTelemetry();
    log("worker", "shutdown complete");
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
