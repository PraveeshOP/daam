import { createServiceClient } from "@/lib/supabase/service";
import { logError } from "@/lib/logger";
import type { TrackEventInput } from "@/lib/analytics/types";

/**
 * The one place an analytics event actually gets written. Callable from anywhere — Server
 * Components, Server Actions, and the worker process alike — since it doesn't touch
 * `next/headers` (only `lib/analytics/identity.ts`, used by the request-scoped call sites, does
 * that). Uses the service-role client deliberately: analytics_events has no insert policy for
 * anon/authenticated at all (see the migration), so this is the *only* way a row gets written,
 * and every value passed in was already computed server-side, never taken from a client-
 * supplied identity.
 *
 * Never throws — a broken analytics write must not break the page/action/job it's attached to
 * (spec §25: "non-blocking recording").
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    const client = createServiceClient();
    const { error } = await client.from("analytics_events").insert({
      event_name: input.eventName,
      user_id: input.userId ?? null,
      anonymous_id: input.anonymousId ?? null,
      product_id: input.productId ?? null,
      store_id: input.storeId ?? null,
      properties: (input.properties ?? {}) as never,
    });
    if (error) logError("analytics", `could not record "${input.eventName}": ${error.message}`);
  } catch (error) {
    logError("analytics", `unexpected error recording "${input.eventName}": ${error instanceof Error ? error.message : error}`);
  }
}
