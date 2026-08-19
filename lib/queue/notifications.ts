import { Queue } from "bullmq";
import { getSharedRedisConnection } from "@/lib/queue/redis";

export const NOTIFICATIONS_QUEUE = "notifications";

/** Kept intentionally small (section 6/21 of the phase spec): just enough to identify which
 * alert fired and at what price, so the email worker can re-read everything else (product,
 * user email) fresh from the database instead of trusting a payload that could go stale. */
export type NotificationJobData = {
  alertId: string;
  triggeredPrice: number;
};

let queue: Queue<NotificationJobData> | null = null;

/**
 * Lives next to the price-collection queue but is enqueued from the collector/importer side
 * (via lib/alerts/evaluate.ts) rather than only from worker/ code — see lib/queue/redis.ts for
 * why the shared Redis connection lives under lib/ instead of worker/.
 */
export function getNotificationsQueue(): Queue<NotificationJobData> {
  if (queue) return queue;
  queue = new Queue<NotificationJobData>(NOTIFICATIONS_QUEUE, {
    connection: getSharedRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    },
  });
  return queue;
}
