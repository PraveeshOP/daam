import { describe, expect, it } from "vitest";
import { parseProductPage, parseProductUrls } from "@/collectors/evo/parser";

const page = `<script type="application/ld+json">${JSON.stringify({
  "@type": "Product",
  name: "iPhone 16",
  sku: "IPHONE-16",
  image: ["https://example.com/phone.jpg"],
  brand: { name: "Apple" },
  additionalProperty: [{ name: "Display", value: "6.1 inch" }],
  offers: { offers: [
    { sku: "IPHONE-16-128", price: "146599", priceCurrency: "NPR", availability: "https://schema.org/InStock", additionalProperty: { name: "Storage", value: "128 GB" } },
    { sku: "IPHONE-16-256", price: "165399", priceCurrency: "NPR", availability: "https://schema.org/OutOfStock", additionalProperty: { name: "Storage", value: "256 GB" } },
  ] },
})}</script>`;

describe("Evo parser", () => {
  it("normalizes JSON-LD offer variants", () => {
    const products = parseProductPage(page, "https://evostore.com.np/iphone16");
    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({ name: "iPhone 16 128 GB", externalId: "IPHONE-16-128", price: 146599, currency: "NPR", availability: "in_stock" });
    expect(products[1].availability).toBe("out_of_stock");
  });

  it("selects only smartphone URLs and respects the limit", () => {
    const sitemap = "<loc>https://evostore.com.np/iphone16</loc><loc>https://evostore.com.np/iphone16-case</loc><loc>https://evostore.com.np/laptop</loc><loc>https://evostore.com.np/samsung-galaxy-s25</loc><loc>https://evostore.com.np/iphone-wallet</loc>";
    expect(parseProductUrls(sitemap, 2)).toEqual(["https://evostore.com.np/iphone16", "https://evostore.com.np/samsung-galaxy-s25"]);
  });

  it("rejects pages without a product name", () => {
    expect(() => parseProductPage("<html></html>", "https://evostore.com.np/broken")).toThrow("missing product");
  });
});
