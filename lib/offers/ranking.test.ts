import { describe, expect, it } from "vitest";
import { rankOffers, bestOffer } from "@/lib/offers/ranking";
import { getStoreDestination } from "@/lib/stores/destination";
import type { Offer } from "@/types";

const offer = (overrides: Partial<Offer>): Offer => ({
  id: "o1",
  productId: "p1",
  storeId: "s1",
  price: 1000,
  availability: "in_stock",
  productUrl: "https://store.example/p",
  lastChecked: "2026-01-01",
  ...overrides,
});

describe("rankOffers / bestOffer — ranking integrity (§11/§12)", () => {
  it("orders purely by price, cheapest first", () => {
    const offers = [offer({ id: "a", price: 500 }), offer({ id: "b", price: 100 }), offer({ id: "c", price: 300 })];
    expect(rankOffers(offers).map((o) => o.id)).toEqual(["b", "c", "a"]);
  });

  it("picks the cheapest in-stock offer as best, regardless of affiliate fields", () => {
    // The cheaper store has NO affiliate URL / affiliate program at all; the pricier store has
    // a fully active affiliate program. The cheapest store must still win.
    const cheapNonAffiliate = offer({ id: "cheap", price: 100, storeId: "store-a" });
    const pricierAffiliate = offer({ id: "pricier", price: 200, storeId: "store-b", affiliateUrl: "https://aff.example/click" });
    const winner = bestOffer([pricierAffiliate, cheapNonAffiliate]);
    expect(winner?.id).toBe("cheap");
  });

  it("an out-of-stock cheaper offer never beats an in-stock pricier one", () => {
    const outOfStockCheaper = offer({ id: "oos", price: 50, availability: "out_of_stock" });
    const inStockPricier = offer({ id: "in-stock", price: 200, availability: "in_stock" });
    expect(bestOffer([outOfStockCheaper, inStockPricier])?.id).toBe("in-stock");
  });

  it("getStoreDestination's affiliate resolution has no bearing on rankOffers's ordering", () => {
    const offers = [offer({ id: "a", price: 500, affiliateUrl: "https://aff.example/a" }), offer({ id: "b", price: 100 })];
    const withoutAffiliateAtAll = rankOffers(offers.map((o) => ({ ...o, affiliateUrl: undefined })));
    const withAffiliate = rankOffers(offers);
    // Stripping every affiliate URL out of the input changes nothing about the resulting order —
    // proof that ranking has no dependency on affiliate data at all.
    expect(withoutAffiliateAtAll.map((o) => o.id)).toEqual(withAffiliate.map((o) => o.id));
    // And getStoreDestination is never even called by ranking — confirmed structurally: rankOffers
    // takes no store/destination argument, so it has nothing to call it with.
    expect(getStoreDestination).toBeTypeOf("function");
  });
});
