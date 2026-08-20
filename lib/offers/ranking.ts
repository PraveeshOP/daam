import type { Offer } from "@/types";

/**
 * §11/§12: the single place offers are ordered for display. Deliberately takes only price and
 * availability into account — it has no parameter for affiliate status, partnership status, or
 * anything from lib/stores/destination.ts, so there is no way for a store's affiliate program
 * to influence which offer shows as cheapest/best. Any future change that wants to add such a
 * signal here should be treated as a ranking-integrity regression, not a feature.
 */
export function rankOffers(offers: Offer[]): Offer[] {
  return [...offers].sort((a, b) => a.price - b.price);
}

export function bestOffer(offers: Offer[]): Offer | undefined {
  const ranked = rankOffers(offers);
  const inStock = ranked.filter((offer) => offer.availability === "in_stock");
  return inStock[0] ?? ranked[0];
}
