import { Queue } from "bullmq";
import { getSharedRedisConnection } from "@/worker/redis";

export const PRICE_COLLECTION_QUEUE = "price-collection";

/** Kept intentionally small — only enough to identify which store/category to run.
 * Full product data never travels through the queue. */
export type PriceCollectionJobData = {
  storeId: string;
  category?: string;
};

let queue: Queue<PriceCollectionJobData> | null = null;

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
