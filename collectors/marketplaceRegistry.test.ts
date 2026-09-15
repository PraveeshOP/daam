import { describe, expect, it } from "vitest";
import { MARKETPLACE_COLLECTORS, MARKETPLACE_SOURCE_IDS, getMarketplaceCollector, isMarketplaceSource } from "@/collectors/marketplaceRegistry";
import { COLLECTORS, STORE_IDS } from "@/collectors/registry";

describe("marketplace registry", () => {
  it("exposes every registered marketplace by its stable sourceId", () => {
    expect(MARKETPLACE_SOURCE_IDS.sort()).toEqual(["hamrobazaar"]);
    for (const sourceId of MARKETPLACE_SOURCE_IDS) {
      expect(MARKETPLACE_COLLECTORS[sourceId].sourceId).toBe(sourceId);
      expect(typeof MARKETPLACE_COLLECTORS[sourceId].collect).toBe("function");
    }
  });

  it("throws a clear error for an unknown sourceId instead of silently doing nothing", () => {
    expect(() => getMarketplaceCollector("does-not-exist")).toThrow(/unknown marketplace sourceId/);
  });

  /**
   * The invariant the whole marketplace split exists to protect: a C2C source must never appear
   * in the retail registry, because `getCollector` feeds `runStoreCollection`, which writes
   * `offers` and `price_history`. If someone later adds HamroBazaar to COLLECTORS "so it shows up
   * with the other stores", this is what should fail.
   */
  it("keeps marketplace sources out of the retail collector registry", () => {
    for (const sourceId of MARKETPLACE_SOURCE_IDS) {
      expect(COLLECTORS[sourceId]).toBeUndefined();
      expect(STORE_IDS).not.toContain(sourceId);
    }
    for (const storeId of STORE_IDS) expect(isMarketplaceSource(storeId)).toBe(false);
  });
});
