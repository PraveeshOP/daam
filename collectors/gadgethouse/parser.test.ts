import { describe, expect, it } from "vitest";
import { parseGadgetHouseProduct, parseGadgetHouseProducts, type GadgetHouseProduct } from "@/collectors/gadgethouse/parser";

/** Trimmed reconstructions of real Gadget House Nepal Store API entries, verified live against
 * https://gadgethousenepal.com/wp-json/wc/store/v1/products?category=45 — one with a blank sku
 * and no brands[] (the 73% common case), one with a populated brands[] (the 16% Xiaomi case). */
const kieslect: GadgetHouseProduct = {
  id: 14125,
  name: "Kieslect Lady Watch Lora, Smart Watch for Women (Answer/Make Calls) &#8211; Elegant Design",
  permalink: "https://gadgethousenepal.com/product/kieslect-lady-watch-lora-smart-watch-for-women-answer-make-calls",
  sku: "Kieslect Lady Watch Lora",
  prices: { price: "749900", currency_minor_unit: 2 },
  images: [{ src: "https://gadgethousenepal.com/wp-content/uploads/kieslect-lora.jpg" }],
  brands: [],
  is_in_stock: true,
};
const xiaomi: GadgetHouseProduct = {
  id: 10917,
  name: "Xiaomi Mi Band 7 Smart Watch",
  permalink: "https://gadgethousenepal.com/product/xiaomi-mi-band-7-smart-watch",
  sku: "",
  prices: { price: "349900", currency_minor_unit: 2 },
  brands: [{ name: "MI" }],
  is_in_stock: true,
};

describe("parseGadgetHouseProduct (WooCommerce Store API — sku is blank on 73% of this category)", () => {
  it("uses the numeric id as external id, never the sku (even when sku looks populated)", () => {
    expect(parseGadgetHouseProduct(kieslect)?.externalId).toBe("14125");
  });

  it("decodes numeric HTML entities (en-dash) in the name", () => {
    expect(parseGadgetHouseProduct(kieslect)?.name).toBe("Kieslect Lady Watch Lora, Smart Watch for Women (Answer/Make Calls) – Elegant Design");
  });

  it("guesses brand from a known prefix in the name when brands[] is empty (the common case on this site)", () => {
    expect(parseGadgetHouseProduct(kieslect)?.brand).toBe("Kieslect");
  });

  it("prefers the real brands[] entry over a name-based guess when it's actually populated", () => {
    expect(parseGadgetHouseProduct(xiaomi)?.brand).toBe("MI");
  });

  it("divides the minor-unit price by 10^currency_minor_unit", () => {
    expect(parseGadgetHouseProduct(kieslect)?.price).toBe(7499);
  });

  it("drops a product with no usable positive price", () => {
    expect(parseGadgetHouseProduct({ ...kieslect, prices: { price: "0", currency_minor_unit: 2 } })).toBeNull();
  });
});

describe("parseGadgetHouseProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: GadgetHouseProduct = { ...kieslect, id: 1, prices: { price: "0", currency_minor_unit: 2 } };
    const rows = parseGadgetHouseProducts([zeroPriced, kieslect, xiaomi], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "14125" })]);
  });
});
