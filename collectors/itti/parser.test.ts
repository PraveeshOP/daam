import { describe, expect, it } from "vitest";
import { parseIttiProduct, parseIttiProductUrls } from "@/collectors/itti/parser";

const payload = { is_product: true, data: { pid: 1789, sku: "iPhone 16 128GB", name: "Apple iPhone 16", short_name: "iPhone 16", description: "<p>Phone</p>", specification: "<table><tr><td>Brand</td><td>Apple</td></tr><tr><td>Model</td><td>iPhone 16</td></tr><tr><td>RAM</td><td>8GB</td></tr><tr><td>Internal Storage</td><td>128GB</td></tr></table>", price: { sku: "iPhone 16 128GB", stock: 0, in_stock: false, selling_price: 141499 }, image: { image: "https://admin.itti.com.np/storage/phone.webp" } } };

describe("ITTI parser", () => {
  it("normalizes product API data", () => {
    const product = parseIttiProduct(payload, "https://itti.com.np/product/apple-iphone-16-128-price-nepal")[0];
    expect(product).toMatchObject({ externalId: "iPhone 16 128GB", name: "Apple iPhone 16 128GB", brand: "Apple", model: "iPhone 16", storage: "128GB", ram: "8GB", price: 141499, availability: "out_of_stock" });
  });
  it("selects smartphone product URLs", () => {
    expect(parseIttiProductUrls("<loc>https://itti.com.np/product/apple-iphone-16-128-price-nepal</loc><loc>https://itti.com.np/product/apple-iphone-case</loc>", 10)).toEqual(["https://itti.com.np/product/apple-iphone-16-128-price-nepal"]);
  });
});
