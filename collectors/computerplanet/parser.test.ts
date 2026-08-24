import { describe, expect, it } from "vitest";
import { parseComputerPlanetProduct, parseComputerPlanetProducts, type ComputerPlanetProduct, type ComputerPlanetProductsResponse } from "@/collectors/computerplanet/parser";

/** A trimmed reconstruction of a real Computer Planet API entry (Acer Aspire 7), verified live
 * against https://cplanetnp.com/api/v1/products?category_id=1. Price here is a plain decimal
 * string, unlike the WooCommerce sites this session (no minor-unit scaling). */
const laptop: ComputerPlanetProduct = {
  id: 279,
  sku: "CP261270",
  name: "Acer Aspire 7 Gaming Laptop (A715-59G) Intel Core i5 13420H - 16GB RAM - 512GB NVMe SSD - RTX 3050 6GB",
  slug: "acer-aspire-7-intel-i5-13420h-rtx-3050-price-nepal",
  price: "160000",
  sale_price: "143999",
  stock_status: "instock",
  featured_image_url: "https://cplanetnp.com/uploads/products/2026/06/acer-aspire-7-....webp",
};

describe("parseComputerPlanetProduct (custom API — price is a plain decimal string, no minor-unit scaling)", () => {
  it("prefers the sale price over the list price", () => {
    expect(parseComputerPlanetProduct(laptop)?.price).toBe(143999);
  });

  it("falls back to the list price when there's no sale price", () => {
    expect(parseComputerPlanetProduct({ ...laptop, sale_price: undefined })?.price).toBe(160000);
  });

  it("builds productUrl from the flat https://cplanetnp.com/<slug> pattern, not /product/<slug> (which redirects)", () => {
    expect(parseComputerPlanetProduct(laptop)?.productUrl).toBe("https://cplanetnp.com/acer-aspire-7-intel-i5-13420h-rtx-3050-price-nepal");
  });

  it("guesses brand from the name's own manufacturer prefix, since the API's own brand field returns a sub-series ('Aspire series') not the manufacturer", () => {
    expect(parseComputerPlanetProduct(laptop)?.brand).toBe("Acer");
  });

  it("extracts RAM/storage from the name, defending against the matcher's RAM-as-storage bug (collectors/core/matcher.ts)", () => {
    expect(parseComputerPlanetProduct(laptop)).toMatchObject({ ram: "16GB", storage: "512GB" });
  });

  it("uses the numeric id as external id, never the sku", () => {
    expect(parseComputerPlanetProduct(laptop)?.externalId).toBe("279");
  });

  it("maps stock_status to this codebase's availability strings", () => {
    expect(parseComputerPlanetProduct({ ...laptop, stock_status: "outofstock" })?.availability).toBe("out_of_stock");
  });

  it("drops a product with no usable positive price", () => {
    expect(parseComputerPlanetProduct({ ...laptop, price: "0", sale_price: "0" })).toBeNull();
  });
});

describe("parseComputerPlanetProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const noPrice: ComputerPlanetProduct = { ...laptop, id: 1, price: "0", sale_price: "0" };
    const response: ComputerPlanetProductsResponse = { data: { data: [noPrice, laptop, { ...laptop, id: 2 }], total_items: 3 } };
    expect(parseComputerPlanetProducts(response, 1)).toEqual([expect.objectContaining({ externalId: "279" })]);
  });
});
