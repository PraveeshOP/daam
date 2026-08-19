import type { Redis } from "ioredis";
import crypto from "node:crypto";

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

const lockKey = (storeId: string) => `price-collection:lock:${storeId}`;

/**
 * Prevents two collection runs for the same store overlapping (spec section 25 — a store may be
 * scheduled AND manually triggered at the same time). Returns a token to release with, or null
 * if another run already holds the lock.
 */
export async function acquireStoreLock(redis: Redis, storeId: string, ttlMs: number): Promise<string | null> {
  const token = crypto.randomUUID();
  const result = await redis.set(lockKey(storeId), token, "PX", ttlMs, "NX");
  return result === "OK" ? token : null;
}

export async function releaseStoreLock(redis: Redis, storeId: string, token: string): Promise<void> {
  await redis.eval(RELEASE_SCRIPT, 1, lockKey(storeId), token);
}
