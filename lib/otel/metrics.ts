import { metrics } from "@opentelemetry/api";

/**
 * The metric list from phase-7 spec §18 — deliberately not "hundreds of unnecessary metrics",
 * just these. Attributes (store id, queue name, ...) are passed at each `.add()`/`.record()`
 * call site, not baked into the instrument itself.
 */
const meter = metrics.getMeter("pricenepal-worker");

export const storeCollectionSuccessTotal = meter.createCounter("store_collection_success_total", {
  description: "Store collection jobs that completed without the job itself failing (per-product errors don't count).",
});
export const storeCollectionFailureTotal = meter.createCounter("store_collection_failure_total", {
  description: "Store collection jobs that failed outright (timeout, thrown error, exhausted retries).",
});
export const storeCollectionDuration = meter.createHistogram("store_collection_duration", {
  description: "Wall-clock duration of a completed store collection.",
  unit: "ms",
});

export const productsCollectedTotal = meter.createCounter("products_collected_total", { description: "Products discovered by a collector run." });
export const productsMatchedTotal = meter.createCounter("products_matched_total", { description: "Store items matched onto an existing canonical product." });
export const productsCreatedTotal = meter.createCounter("products_created_total", { description: "New canonical products created by a collector run." });
export const priceChangesTotal = meter.createCounter("price_changes_total", { description: "Genuine price changes recorded to price_history." });

export const bullmqJobsCompletedTotal = meter.createCounter("bullmq_jobs_completed_total", { description: "BullMQ jobs completed, across both queues." });
export const bullmqJobsFailedTotal = meter.createCounter("bullmq_jobs_failed_total", { description: "BullMQ jobs failed (one per attempt), across both queues." });

export const notificationSentTotal = meter.createCounter("notification_sent_total", { description: "Price-alert emails successfully sent." });
export const notificationFailedTotal = meter.createCounter("notification_failed_total", { description: "Price-alert email send attempts that failed (one per attempt)." });
