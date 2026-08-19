import { describe, expect, it } from "vitest";
import type { Redis } from "ioredis";
import { acquireStoreLock, releaseStoreLock } from "@/worker/lock";

/** Minimal in-memory stand-in for the two ioredis calls the lock uses (SET NX/PX and EVAL),
 * so the acquire/release semantics can be verified without a live Redis server. */
function createFakeRedis(): Redis {
  const store = new Map<string, { value: string; expiresAt: number }>();
  const get = (key: string) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) { store.delete(key); return null; }
    return entry.value;
  };
  return {
    async set(key: string, value: string, ...flags: unknown[]) {
      const pxIndex = flags.indexOf("PX");
      const ttlMs = pxIndex >= 0 ? Number(flags[pxIndex + 1]) : Infinity;
      const nx = flags.includes("NX");
      if (nx && get(key) !== null) return null;
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return "OK";
    },
    async eval(_script: string, _numKeys: number, key: string, token: string) {
      if (get(key) === token) { store.delete(key); return 1; }
      return 0;
    },
  } as unknown as Redis;
}

describe("store lock", () => {
  it("lets a second acquire attempt fail while the first lock is held (prevents concurrent runs of the same store)", async () => {
    const redis = createFakeRedis();
    const first = await acquireStoreLock(redis, "evo-store", 60_000);
    const second = await acquireStoreLock(redis, "evo-store", 60_000);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("lets a new run acquire the lock again after release", async () => {
    const redis = createFakeRedis();
    const first = await acquireStoreLock(redis, "evo-store", 60_000);
    await releaseStoreLock(redis, "evo-store", first!);
    const second = await acquireStoreLock(redis, "evo-store", 60_000);
    expect(second).not.toBeNull();
  });

  it("does not let one store's lock block a different store", async () => {
    const redis = createFakeRedis();
    const evo = await acquireStoreLock(redis, "evo-store", 60_000);
    const itti = await acquireStoreLock(redis, "itti", 60_000);
    expect(evo).not.toBeNull();
    expect(itti).not.toBeNull();
  });

  it("refuses to release a lock using someone else's token", async () => {
    const redis = createFakeRedis();
    const token = await acquireStoreLock(redis, "evo-store", 60_000);
    await releaseStoreLock(redis, "evo-store", "wrong-token");
    // still held: a second acquire attempt should fail
    const second = await acquireStoreLock(redis, "evo-store", 60_000);
    expect(token).not.toBeNull();
    expect(second).toBeNull();
  });
});
