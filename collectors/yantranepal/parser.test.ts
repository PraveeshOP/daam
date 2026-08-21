import { describe, expect, it } from "vitest";
import { parseYantraProduct, parseYantraProducts, type YantraProduct } from "@/collectors/yantranepal/parser";

/** A trimmed reconstruction of a real Yantra Nepal Store API entry (Asus Vivobook S14), verified
 * live against https://yantranepal.com/wp-json/wc/store/v1/products?category=530. Note: this
 * site's API has NO `brands` field at all — brand only comes from `categories[]`. */
const laptop: YantraProduct = {
  id: 28655,
  name: "Asus Vivobook S 14 S5406 SA OLED | Intel Core Ultra 7 258V, 32GB RAM, 1TB SSD, 14.0-inch, WUXGA (1920 &#215; 1200) OLED, 15.3&#8243; Display",
  permalink: "https://yantranepal.com/asus-vivobook-s-14-s5406-price-nepal/",
  sku: "EDN2104",
  prices: { price: "21000000", sale_price: "21000000", currency_minor_unit: 2 },
  images: [{ src: "https://yantranepal.com/wp-content/uploads/2026/07/Asus-Vivobook-S14-Oled-Ultra-7-1.webp" }],
  categories: [{ id: 530, name: "Laptops" }, { id: 540, name: "Asus" }, { id: 1355, name: "i7 Laptops" }],
  is_in_stock: true,
};

describe("parseYantraProduct (WooCommerce Store API — no brands[] field at all on this site)", () => {
  it("divides the minor-unit price by 10^currency_minor_unit", () => {
    expect(parseYantraProduct(laptop)?.price).toBe(210000);
  });

  it("decodes numeric HTML entities (&#215; is U+00D7 MULTIPLICATION SIGN, &#8243; is U+2033 DOUBLE PRIME — not their ASCII look-alikes) in the name", () => {
    expect(parseYantraProduct(laptop)?.name).toBe("Asus Vivobook S 14 S5406 SA OLED | Intel Core Ultra 7 258V, 32GB RAM, 1TB SSD, 14.0-inch, WUXGA (1920 × 1200) OLED, 15.3″ Display");
  });

  it("derives brand from a known-brand entry in categories[], since this site's API has no brands field at all", () => {
    expect(parseYantraProduct(laptop)?.brand).toBe("Asus");
  });

  it("leaves brand undefined when no category matches a known laptop brand", () => {
    const noKnownBrand = { ...laptop, categories: [{ id: 530, name: "Laptops" }, { id: 1355, name: "i7 Laptops" }] };
    expect(parseYantraProduct(noKnownBrand)?.brand).toBeUndefined();
  });

  it("uses the numeric id as external id, never the sku", () => {
    expect(parseYantraProduct(laptop)?.externalId).toBe("28655");
  });

  it("reads is_in_stock directly for availability", () => {
    expect(parseYantraProduct({ ...laptop, is_in_stock: false })?.availability).toBe("out_of_stock");
  });

  it("drops a product with no usable positive price", () => {
    expect(parseYantraProduct({ ...laptop, prices: { price: "0", sale_price: "0", currency_minor_unit: 2 } })).toBeNull();
  });

  it("extracts RAM/storage from a '<RAM>GB DDR5 <speed>MHz RAM, <storage>GB Gen 4 SSD'-style name as distinct fields (same defense applied to collectors/dealayo/parser.ts against the matcher bug in collectors/core/matcher.ts)", () => {
    const dell: YantraProduct = { ...laptop, name: "Dell Inspiron 14 Plus 7440 | Intel Ultra 7 155H, 16GB LPDDR5X 6400MHz RAM, 1TB Gen 4 NVMe SSD, 14-inch Display" };
    expect(parseYantraProduct(dell)).toMatchObject({ ram: "16GB", storage: "1TB" });
  });
});

describe("parseYantraProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: YantraProduct = { ...laptop, id: 1, prices: { price: "0", currency_minor_unit: 2 } };
    const rows = parseYantraProducts([zeroPriced, laptop, { ...laptop, id: 2 }], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "28655" })]);
  });
});
