import { describe, expect, it } from "vitest";
import { COLLECTORS, STORE_IDS, getCollector } from "@/collectors/registry";

describe("collector registry", () => {
  it("exposes every registered store by its stable storeId", () => {
    expect(STORE_IDS.sort()).toEqual(["evo-store", "evo-store-laptops", "itti", "itti-laptops", "itti-gaming", "mobilemandu", "mobilemandu-laptops", "mobilemandu-audio", "mobilemandu-tv", "mobilemandu-smartwatches", "mobilemandu-appliances", "neostore", "hukut-laptops", "brothermart", "itechstore", "neptronics", "zolpastore", "smartdoko", "lds", "yantranepal", "gadgethouse", "dealayo", "electromandu", "techinn", "infotechsnepal", "computerplanet", "mystore", "maxell", "nepomart", "onlineit", "maxinternational", "tronixspace", "meroepasal", "bigbyte", "sewasmart", "rapidotech", "exortstore"].sort());
    for (const storeId of STORE_IDS) {
      expect(COLLECTORS[storeId].storeId).toBe(storeId);
      expect(typeof COLLECTORS[storeId].collect).toBe("function");
    }
  });

  it("looks up a known store", () => {
    expect(getCollector("itti").store.name).toBe("ITTI");
  });

  it("throws a clear error for an unknown storeId instead of silently doing nothing", () => {
    expect(() => getCollector("does-not-exist")).toThrow(/unknown storeId/);
  });
});
