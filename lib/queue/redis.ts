import { loadEnvConfig } from "@next/env";
import IORedis, { type Redis } from "ioredis";
import { log, logError } from "@/lib/logger";

loadEnvConfig(process.cwd());

/**
 * Creates a dedicated Redis connection. BullMQ Workers hold a blocking connection open, so
 * each Worker/Queue/QueueEvents that needs one calls this once at startup and reuses the
 * instance for its lifetime — never per job. `name` is only for readable error logs.
 *
 * Lives under lib/ (not worker/) because both the worker process and the price-collection
 * pipeline (collectors/core/importer.ts, via lib/alerts/evaluate.ts) need a queue connection —
 * the importer enqueues notification jobs without depending on worker-only code.
 */
export function createRedisConnection(name: string): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required (e.g. redis://localhost:6379)");
  const connection = new IORedis(url, {
    // Required by BullMQ: it manages its own retry/backoff for blocking commands.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (attempt) => Math.min(attempt * 500, 10_000),
  });
  connection.on("error", (error) => logError(`redis:${name}`, `connection error: ${error.message}`));
  connection.on("connect", () => log(`redis:${name}`, "connected"));
  connection.on("reconnecting", () => log(`redis:${name}`, "reconnecting"));
  return connection;
}

let sharedConnection: Redis | null = null;

/** One shared, non-blocking connection reused by the queues and the scheduler. */
export function getSharedRedisConnection(): Redis {
  if (!sharedConnection) sharedConnection = createRedisConnection("shared");
  return sharedConnection;
}

export async function closeRedisConnection(connection: Redis | null) {
  if (!connection) return;
  try {
    await connection.quit();
  } catch {
    connection.disconnect();
  }
}
