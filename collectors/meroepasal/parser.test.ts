import { describe, expect, it } from "vitest";
import { parseMeroepasalProduct, parseMeroepasalProducts, type MeroepasalProduct } from "@/collectors/meroepasal/parser";

/** Trimmed reconstructions of real MeroEpasal Store API entries, verified live — one with a
 * populated brands[] (AC), one where brands[] was empty on a real product (washing machine). */
const ac: MeroepasalProduct = {
  id: 10051,
  name: "Voltas 2.0 Ton Inverter Air Conditioner &#8211; 24VH Vectra Platina",
  permalink: "https://meroepasal.com/product/voltas-2-0-ton-inverter-ac/",
  sku: "",
  prices: { price: "11917500", currency_minor_unit: 2 },
  images: [{ src: "https://meroepasal.com/wp-content/uploads/voltas-ac.png" }],
  brands: [{ name: "Voltas" }],
  is_in_stock: true,
};
const washer: MeroepasalProduct = {
  id: 7083,
  name: "Hisense 10KG Fully Automatic Front Load Inverter Washing Machine",
  permalink: "https://meroepasal.com/product/hisense-10kg-front-load-washer/",
  sku: "",
  prices: { price: "6599900", currency_minor_unit: 2 },
  brands: [],
  is_in_stock: true,
};

describe("parseMeroepasalProduct (WooCommerce Store API across 4 leaf appliance categories)", () => {
  it("decodes a numeric HTML entity (en-dash) and divides the minor-unit price", () => {
    const product = parseMeroepasalProduct(ac);
    expect(product?.name).toBe("Voltas 2.0 Ton Inverter Air Conditioner – 24VH Vectra Platina");
    expect(product?.price).toBe(119175);
  });

  it("prefers the real brands[] entry when populated", () => {
    expect(parseMeroepasalProduct(ac)?.brand).toBe("Voltas");
  });

  it("falls back to a known-brand prefix in the name when brands[] is empty (verified live on a real Hisense washer)", () => {
    expect(parseMeroepasalProduct(washer)?.brand).toBe("HISENSE");
  });

  it("uses the numeric id as external id, never the sku", () => {
    expect(parseMeroepasalProduct(ac)?.externalId).toBe("10051");
  });

  it("drops a product with no usable positive price", () => {
    expect(parseMeroepasalProduct({ ...ac, prices: { price: "0", currency_minor_unit: 2 } })).toBeNull();
  });
});

describe("parseMeroepasalProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: MeroepasalProduct = { ...ac, id: 1, prices: { price: "0", currency_minor_unit: 2 } };
    const rows = parseMeroepasalProducts([zeroPriced, ac, washer], 2);
    expect(rows).toEqual([expect.objectContaining({ externalId: "10051" }), expect.objectContaining({ externalId: "7083" })]);
  });
});
