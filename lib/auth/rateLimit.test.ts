import { describe, expect, it, vi } from "vitest";

/**
 * A fake in-memory Redis stand-in (same style as worker/lock.test.ts) rather than a real Redis
 * connection — this test needs to pass in CI, which has no live Redis service, and needs to run
 * under NODE_ENV=test, where REDIS_URL (only ever set in .env.local, which Next's own env
 * loader deliberately skips under NODE_ENV=test) isn't available anyway.
 */
function createFakeRedis() {
  const counters = new Map<string, { count: number; expiresAt: number }>();
  return {
    async incr(key: string) {
      const now = Date.now();
      const entry = counters.get(key);
      if (!entry || entry.expiresAt < now) {
        counters.set(key, { count: 1, expiresAt: Infinity });
        return 1;
      }
      entry.count += 1;
      return entry.count;
    },
    async expire(key: string, seconds: number) {
      const entry = counters.get(key);
      if (entry) entry.expiresAt = Date.now() + seconds * 1000;
    },
  };
}

// getSharedRedisConnection is meant to return the SAME connection every call (that's the point
// of "shared") — so the mock returns one persistent fake instance, not a fresh store each time.
const sharedFakeRedis = createFakeRedis();
vi.mock("@/lib/queue/redis", () => ({
  getSharedRedisConnection: () => sharedFakeRedis,
}));

const { withinLimit } = await import("@/lib/auth/rateLimit");

describe("withinLimit — auth rate-limit counter mechanics (§H5, phase-9 audit)", () => {
  it("allows up to max attempts, then blocks the next one within the same window", async () => {
    const key = `test:rate-limit:${Math.random()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) results.push(await withinLimit(key, 5, 60));
    expect(results).toEqual([true, true, true, true, true, false]);
  });

  it("uses an independent counter per key", async () => {
    const keyA = `test:rate-limit:${Math.random()}:a`;
    const keyB = `test:rate-limit:${Math.random()}:b`;
    for (let i = 0; i < 5; i++) await withinLimit(keyA, 5, 60);
    expect(await withinLimit(keyA, 5, 60)).toBe(false);
    expect(await withinLimit(keyB, 5, 60)).toBe(true);
  });
});
