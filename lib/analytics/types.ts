import type { Json } from "@/types/database";

/**
 * The complete, deliberately short list of tracked events (phase-7 spec §3) — see
 * docs/analytics-and-observability.md for what's collected and, just as importantly, what
 * isn't (no passwords, tokens, IPs, or full request bodies; §6).
 */
export type AnalyticsEventName =
  | "search"
  | "product_view"
  | "store_click"
  | "favorite_added"
  | "favorite_removed"
  | "price_alert_created"
  | "price_alert_deleted"
  | "price_alert_triggered";

/** Runtime-checkable mirror of AnalyticsEventName — a TypeScript union alone doesn't stop an
 * actual network caller (e.g. trackEventAction, a Server Action) from sending an arbitrary
 * string, so anything that receives this over the wire re-validates against this array (§H-
 * analytics, phase-9 audit). */
export const ANALYTICS_EVENT_NAMES: AnalyticsEventName[] = [
  "search",
  "product_view",
  "store_click",
  "favorite_added",
  "favorite_removed",
  "price_alert_created",
  "price_alert_deleted",
  "price_alert_triggered",
];

export type AnalyticsProperties = Record<string, Json>;

export type TrackEventInput = {
  eventName: AnalyticsEventName;
  userId?: string | null;
  anonymousId?: string | null;
  productId?: string | null;
  storeId?: string | null;
  properties?: AnalyticsProperties;
};
