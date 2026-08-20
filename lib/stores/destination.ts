export type DestinationType = "affiliate" | "direct";

export type DestinationResult = {
  url: string;
  type: DestinationType;
};

export type OfferForDestination = {
  productUrl: string;
  affiliateUrl?: string | null;
};

export type StoreForDestination = {
  affiliateEnabled: boolean;
  partnershipStatus: string;
  trackingParams?: Record<string, string> | null;
};

function isValidHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Appends store-specific tracking params (ref, affiliate_id, utm_*, ...) without ever
 * overwriting a param the affiliate URL already carries — §18: "do not modify URLs in ways
 * that could break the store's tracking system." Different networks need different params, so
 * this is a flexible map (`stores.tracking_params`) rather than one hardcoded format.
 */
export function applyTrackingParams(url: string, params: Record<string, string> | null | undefined): string {
  if (!params || Object.keys(params).length === 0) return url;
  try {
    const parsed = new URL(url);
    for (const [key, value] of Object.entries(params)) {
      if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * The one place "which URL do we actually send a click to" is decided (§6) — never scattered
 * across components. Affiliate is used only when the store has explicitly opted in
 * (`affiliateEnabled`) AND the partnership is currently `active` (not `pending`/`paused`/`none`)
 * AND the offer actually has a well-formed affiliate URL; any other combination falls back to
 * the normal product URL. This function has no knowledge of price/ranking — callers that sort
 * offers do so before ever calling this, so affiliate status structurally cannot affect ranking.
 */
export function getStoreDestination(offer: OfferForDestination, store: StoreForDestination): DestinationResult {
  const canUseAffiliate = store.affiliateEnabled && store.partnershipStatus === "active" && isValidHttpUrl(offer.affiliateUrl);
  if (canUseAffiliate) {
    return { url: applyTrackingParams(offer.affiliateUrl!, store.trackingParams), type: "affiliate" };
  }
  return { url: offer.productUrl, type: "direct" };
}

export type AffiliateUrlValidation = "none" | "valid" | "invalid";

/** For admin-visible validation (§23) — never means "fetch the URL", just "is this a
 * well-formed http(s) URL". */
export function validateAffiliateUrl(affiliateUrl: string | null | undefined): AffiliateUrlValidation {
  if (!affiliateUrl) return "none";
  return isValidHttpUrl(affiliateUrl) ? "valid" : "invalid";
}
