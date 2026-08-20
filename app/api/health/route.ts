import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getSharedRedisConnection } from "@/lib/queue/redis";

/**
 * §H-health (phase-9 audit): no health-check endpoint existed anywhere. This is deliberately
 * unauthenticated (a health check has to be reachable by an external monitor that doesn't have
 * — and shouldn't need — admin credentials) and read-only: it checks the two things that would
 * actually make the site degrade if unreachable (the database and the Redis instance the
 * collection queue depends on), nothing else. Not a substitute for the richer, admin-only
 * `/admin/observability` page — this is meant to be cheap enough to poll every minute.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  try {
    const service = createServiceClient();
    const { error } = await service.from("stores").select("id", { count: "exact", head: true }).limit(1);
    checks.database = error ? "error" : "ok";
  } catch {
    checks.database = "error";
  }

  try {
    const redis = getSharedRedisConnection();
    const pong = await redis.ping();
    checks.redis = pong === "PONG" ? "ok" : "error";
  } catch {
    checks.redis = "error";
  }

  const healthy = Object.values(checks).every((status) => status === "ok");
  return NextResponse.json({ status: healthy ? "ok" : "degraded", checks }, { status: healthy ? 200 : 503 });
}
