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

export type AnalyticsProperties = Record<string, Json>;

export type TrackEventInput = {
  eventName: AnalyticsEventName;
  userId?: string | null;
  anonymousId?: string | null;
  productId?: string | null;
  storeId?: string | null;
  properties?: AnalyticsProperties;
};
