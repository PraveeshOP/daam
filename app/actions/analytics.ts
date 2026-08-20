"use server";

import { trackEvent } from "@/lib/analytics/track";
import { getTrackingIdentity } from "@/lib/analytics/identity";
import type { AnalyticsEventName, AnalyticsProperties } from "@/lib/analytics/types";

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
  const { userId, anonymousId } = await getTrackingIdentity();
  await trackEvent({
    eventName,
    userId,
    anonymousId,
    productId: typeof properties.product_id === "string" ? properties.product_id : null,
    storeId: typeof properties.store_id === "string" ? properties.store_id : null,
    properties,
  });
}
