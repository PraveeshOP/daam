import { describe, expect, it } from "vitest";
import { applyTrackingParams, getStoreDestination, validateAffiliateUrl } from "@/lib/stores/destination";

const activeAffiliateStore = { affiliateEnabled: true, partnershipStatus: "active" };
const directStore = { affiliateEnabled: false, partnershipStatus: "none" };

describe("getStoreDestination", () => {
  it("falls back to the product URL when the store has no affiliate program", () => {
    const result = getStoreDestination({ productUrl: "https://store.example/p/1" }, directStore);
    expect(result).toEqual({ url: "https://store.example/p/1", type: "direct" });
  });

  it("uses the affiliate URL when the store is enabled, active, and the URL is valid", () => {
    const result = getStoreDestination(
      { productUrl: "https://store.example/p/1", affiliateUrl: "https://aff.example/click?id=1" },
      activeAffiliateStore,
    );
    expect(result).toEqual({ url: "https://aff.example/click?id=1", type: "affiliate" });
  });

  it("falls back to direct when affiliateEnabled is false, even with a valid affiliate URL", () => {
    const result = getStoreDestination(
      { productUrl: "https://store.example/p/1", affiliateUrl: "https://aff.example/click?id=1" },
      { affiliateEnabled: false, partnershipStatus: "active" },
    );
    expect(result.type).toBe("direct");
  });

  it("falls back to direct when the partnership is paused, even if affiliate is enabled", () => {
    const result = getStoreDestination(
      { productUrl: "https://store.example/p/1", affiliateUrl: "https://aff.example/click?id=1" },
      { affiliateEnabled: true, partnershipStatus: "paused" },
    );
    expect(result.type).toBe("direct");
  });

  it("falls back to direct when the partnership is only pending", () => {
    const result = getStoreDestination(
      { productUrl: "https://store.example/p/1", affiliateUrl: "https://aff.example/click?id=1" },
      { affiliateEnabled: true, partnershipStatus: "pending" },
    );
    expect(result.type).toBe("direct");
  });

  it("falls back to direct when the affiliate URL is malformed — never redirects to garbage", () => {
    const result = getStoreDestination(
      { productUrl: "https://store.example/p/1", affiliateUrl: "not a url" },
      activeAffiliateStore,
    );
    expect(result).toEqual({ url: "https://store.example/p/1", type: "direct" });
  });

  it("rejects non-http(s) affiliate URL schemes", () => {
    const result = getStoreDestination(
      { productUrl: "https://store.example/p/1", affiliateUrl: "javascript:alert(1)" },
      activeAffiliateStore,
    );
    expect(result.type).toBe("direct");
  });

  it("applies store tracking params to the affiliate URL", () => {
    const result = getStoreDestination(
      { productUrl: "https://store.example/p/1", affiliateUrl: "https://aff.example/click" },
      { ...activeAffiliateStore, trackingParams: { ref: "pricenepal", utm_source: "pricenepal" } },
    );
    expect(result.url).toBe("https://aff.example/click?ref=pricenepal&utm_source=pricenepal");
  });

  it("never overwrites a query param the affiliate URL already has", () => {
    const result = getStoreDestination(
      { productUrl: "https://store.example/p/1", affiliateUrl: "https://aff.example/click?ref=existing" },
      { ...activeAffiliateStore, trackingParams: { ref: "pricenepal" } },
    );
    expect(result.url).toBe("https://aff.example/click?ref=existing");
  });
});

describe("applyTrackingParams", () => {
  it("returns the url unchanged when there are no params", () => {
    expect(applyTrackingParams("https://example.com", null)).toBe("https://example.com");
    expect(applyTrackingParams("https://example.com", {})).toBe("https://example.com");
  });

  it("returns the url unchanged if it is malformed, rather than throwing", () => {
    expect(applyTrackingParams("not a url", { ref: "x" })).toBe("not a url");
  });
});

describe("validateAffiliateUrl", () => {
  it("is 'none' when there is no affiliate URL", () => {
    expect(validateAffiliateUrl(null)).toBe("none");
    expect(validateAffiliateUrl(undefined)).toBe("none");
    expect(validateAffiliateUrl("")).toBe("none");
  });

  it("is 'valid' for a well-formed http(s) URL", () => {
    expect(validateAffiliateUrl("https://aff.example/click?id=1")).toBe("valid");
  });

  it("is 'invalid' for a malformed URL", () => {
    expect(validateAffiliateUrl("not a url")).toBe("invalid");
    expect(validateAffiliateUrl("ftp://example.com")).toBe("invalid");
  });
});
