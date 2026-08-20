import { Queue } from "bullmq";
import { getSharedRedisConnection } from "@/lib/queue/redis";

export const PRICE_COLLECTION_QUEUE = "price-collection";

/** Kept intentionally small — only enough to identify which store/category to run.
 * Full product data never travels through the queue. */
export type PriceCollectionJobData = {
  storeId: string;
  category?: string;
};

let queue: Queue<PriceCollectionJobData> | null = null;

/**
 * Lives under lib/ (not worker/) because both the worker process and the admin dashboard
 * (to show collection history and to enqueue a manual "Run collection") need it — same reason
 * lib/queue/notifications.ts and lib/queue/redis.ts moved out of worker/ in phase 5.
 */
export function getPriceCollectionQueue(): Queue<PriceCollectionJobData> {
  if (queue) return queue;
  queue = new Queue<PriceCollectionJobData>(PRICE_COLLECTION_QUEUE, {
    connection: getSharedRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 200 },
    },
  });
  return queue;
}
