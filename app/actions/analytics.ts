"use server";

import { trackEvent } from "@/lib/analytics/track";
import { getTrackingIdentity } from "@/lib/analytics/identity";
import { shouldRecordClick } from "@/lib/stores/clickRateLimit";
import { ANALYTICS_EVENT_NAMES, type AnalyticsEventName, type AnalyticsProperties } from "@/lib/analytics/types";

// §H-analytics (phase-9 audit): a Server Action is a real network endpoint — the
// `AnalyticsEventName` union only constrains callers written in this codebase, not an arbitrary
// POST to this action, so both the event name and the properties payload are re-validated here
// at runtime rather than trusted at the type level. Not currently reachable from any component
// (checked: no import of trackEventAction exists yet), but this is the safety net that has to be
// in place *before* it's ever wired up, not after.
const MAX_PROPERTIES_BYTES = 2000;

/**
 * The boundary client components call for events that have no other server round-trip to piggy-
 * back on (currently just `store_click` — a plain external link click). Resolves identity from
 * the request's own cookies/session, so the client never has to know or supply user/anonymous
 * ids itself. Call this without awaiting it from the client (`void trackEventAction(...)`) so it
 * never delays the action the user is actually taking (§25/§27).
 */
export async function trackEventAction(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties & { product_id?: string; store_id?: string } = {},
): Promise<void> {
  if (!ANALYTICS_EVENT_NAMES.includes(eventName)) return;

  const { userId, anonymousId } = await getTrackingIdentity();
  const allowed = await shouldRecordClick(`analytics:${userId ?? anonymousId ?? "anonymous"}`);
  if (!allowed) return;

  const safeProperties = JSON.stringify(properties).length <= MAX_PROPERTIES_BYTES ? properties : {};
  await trackEvent({
    eventName,
    userId,
    anonymousId,
    productId: typeof properties.product_id === "string" ? properties.product_id : null,
    storeId: typeof properties.store_id === "string" ? properties.store_id : null,
    properties: safeProperties,
  });
}
