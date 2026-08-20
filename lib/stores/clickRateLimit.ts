import { getSharedRedisConnection } from "@/lib/queue/redis";
import { logError } from "@/lib/logger";

const WINDOW_SECONDS = 60;
const MAX_CLICKS_PER_WINDOW = 20;

/**
 * §22: "basic rate limiting... sufficient for the initial implementation" — reuses the same
 * Redis connection the price-collection queue already depends on, rather than adding new
 * infrastructure. This only gates whether a click gets *recorded* in analytics; the redirect
 * itself always happens regardless (a real user should never be blocked from reaching the
 * store because a Redis hiccup — or a burst of legitimate fast clicking — looked like abuse).
 */
export async function shouldRecordClick(identityKey: string): Promise<boolean> {
  try {
    const redis = getSharedRedisConnection();
    const key = `click-rate:${identityKey}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SECONDS);
    return count <= MAX_CLICKS_PER_WINDOW;
  } catch (error) {
    logError("stores", `click rate limit check failed, recording anyway: ${error instanceof Error ? error.message : error}`);
    return true;
  }
}
