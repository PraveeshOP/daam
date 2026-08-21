import { describe, expect, it } from "vitest";
import { parseDealayoProduct, parseDealayoProducts, type DealayoProduct, type DealayoProductsResponse } from "@/collectors/dealayo/parser";

/** A trimmed reconstruction of a real DealAyo GraphQL product entry (Vivo V60 5G), verified live
 * against https://dealayo.com/graphql. */
const phone: DealayoProduct = {
  id: 76275,
  sku: "vivo-v60-5g-12-512",
  name: "Vivo V60 5G 12GB RAM 512GB Storage Mobile Phone",
  url_key: "vivo-v60-5g-12gb-ram-512gb-storage-mobile-phone",
  stock_status: "IN_STOCK",
  price_range: { minimum_price: { final_price: { value: 74999, currency: "NPR" } } },
  image: { url: "https://dealayo.com/media/catalog/product/v/i/vivo-v60-blue-1_1.jpg?store=default&image-type=image" },
};

describe("parseDealayoProduct (Magento GraphQL — price is already a plain decimal, no minor-unit scaling)", () => {
  it("uses the numeric id as external id, never the free-text sku", () => {
    expect(parseDealayoProduct(phone)?.externalId).toBe("76275");
  });

  it("builds the productUrl from url_key, not sku (sku formatting is inconsistent across products)", () => {
    expect(parseDealayoProduct(phone)?.productUrl).toBe("https://dealayo.com/vivo-v60-5g-12gb-ram-512gb-storage-mobile-phone.html");
  });

  it("guesses brand from a known prefix in the name, since brand isn't exposed via GraphQL at all", () => {
    expect(parseDealayoProduct(phone)?.brand).toBe("Vivo");
  });

  it("reads price directly with no minor-unit division", () => {
    expect(parseDealayoProduct(phone)?.price).toBe(74999);
  });

  it("maps stock_status enum values to this codebase's availability strings", () => {
    expect(parseDealayoProduct({ ...phone, stock_status: "OUT_OF_STOCK" })?.availability).toBe("out_of_stock");
    expect(parseDealayoProduct({ ...phone, stock_status: undefined })?.availability).toBe("unknown");
  });

  it("drops a product with no usable positive price", () => {
    expect(parseDealayoProduct({ ...phone, price_range: undefined })).toBeNull();
  });

  it("§RAM-mislabeled-as-storage regression: extracts RAM and storage as distinct fields — a real pair of variants sharing '12GB RAM' but differing only in storage (512GB vs 256GB) silently merged into one product before this fix (see collectors/core/matcher.ts)", () => {
    const variant512 = parseDealayoProduct(phone);
    const variant256 = parseDealayoProduct({ ...phone, id: 76274, name: "Vivo V60 5G 12GB RAM 256GB Storage Mobile Phone", price_range: { minimum_price: { final_price: { value: 70999, currency: "NPR" } } } });
    expect(variant512).toMatchObject({ ram: "12GB", storage: "512GB" });
    expect(variant256).toMatchObject({ ram: "12GB", storage: "256GB" });
  });
});

describe("parseDealayoProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const noPrice: DealayoProduct = { ...phone, id: 1, price_range: undefined };
    const response: DealayoProductsResponse = { data: { products: { total_count: 3, items: [noPrice, phone, { ...phone, id: 2 }] } } };
    expect(parseDealayoProducts(response, 1)).toEqual([expect.objectContaining({ externalId: "76275" })]);
  });
});
