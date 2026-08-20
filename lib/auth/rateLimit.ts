import { headers } from "next/headers";
import { getSharedRedisConnection } from "@/lib/queue/redis";
import { logError } from "@/lib/logger";

/**
 * §H5 (phase-9 audit): login/signup/password-reset are public Server Actions with no throttle
 * at all — a real brute-force/credential-stuffing/email-bombing target. Reuses the same Redis
 * instance and fixed-window-counter approach as lib/stores/clickRateLimit.ts rather than adding
 * new infrastructure.
 *
 * The IP address used as the rate-limit key is read transiently from request headers and only
 * ever touches Redis as a short-lived counter key (never written to any table, never joined to a
 * user record) — this is a different concern from docs/analytics-and-observability.md's "no IP
 * addresses" policy, which is about what gets persisted in `analytics_events`, not about
 * ephemeral abuse-prevention counters.
 */
async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headerList.get("x-real-ip") || "unknown";
}

/**
 * Fails OPEN on a Redis error — an auth outage should never become a site-wide login/signup
 * outage just because the rate limiter's own dependency hiccupped (same trade-off
 * clickRateLimit.ts makes for click recording).
 */
export async function withinLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const redis = getSharedRedisConnection();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return count <= max;
  } catch (error) {
    logError("auth", `rate limit check failed, allowing anyway: ${error instanceof Error ? error.message : error}`);
    return true;
  }
}

/** 5 attempts / 15 minutes per IP — a real user mistyping a password a few times is unaffected;
 * a credential-stuffing script cycling passwords against one account is not. */
export async function withinLoginLimit(): Promise<boolean> {
  const ip = await clientIp();
  return withinLimit(`auth-rate:login:${ip}`, 5, 15 * 60);
}

/** 3 / hour per IP — signup and password-reset both trigger an outbound email, so the cap is
 * about email-quota/spam exposure as much as brute force. */
export async function withinSignUpLimit(): Promise<boolean> {
  const ip = await clientIp();
  return withinLimit(`auth-rate:signup:${ip}`, 3, 60 * 60);
}

export async function withinPasswordResetLimit(): Promise<boolean> {
  const ip = await clientIp();
  return withinLimit(`auth-rate:reset:${ip}`, 3, 60 * 60);
}
