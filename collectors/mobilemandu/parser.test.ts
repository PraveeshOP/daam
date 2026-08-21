import { describe, expect, it } from "vitest";
import { parseMobilemanduProduct, parseMobilemanduProductUrls } from "@/collectors/mobilemandu/parser";

const phonePage = `<script type="application/ld+json">${JSON.stringify({
  "@type": "Product",
  name: "Apple iPhone 16 (128 GB) || Mobile Phones",
  sku: "1835",
  image: ["https://admin.mobilemandu.com/storage/3838/iphone16.webp"],
  brand: { name: "Apple" },
  category: "Mobile Phones",
  description: "The iPhone 16.",
  offers: { url: "https://mobilemandu.com/products/apple-iphone-16-128gb-storage", priceCurrency: "NPR", price: "146599.00", availability: "https://schema.org/InStock" },
})}</script>`;

const outOfStockPage = `<script type="application/ld+json">${JSON.stringify({
  "@type": "Product",
  name: "Samsung Galaxy S24 (8/256) |  Immersive viewing and gaming",
  sku: "1043",
  brand: { name: "Samsung" },
  category: "Mobile Phones",
  offers: { url: "https://mobilemandu.com/products/samsung-galaxy-s24-8256-immersive-viewing-and-gaming", priceCurrency: "NPR", price: "99999.00", availability: "https://schema.org/OutOfStock" },
})}</script>`;

const tabletPage = `<script type="application/ld+json">${JSON.stringify({
  "@type": "Product",
  name: "Redmi pad pro 5G (8/256)",
  sku: "2200",
  brand: { name: "Xiaomi" },
  category: "Tablets",
  offers: { url: "https://mobilemandu.com/products/redmi-pad-pro-5g-8gb-ram-256gb-storage", priceCurrency: "NPR", price: "45999.00", availability: "https://schema.org/InStock" },
})}</script>`;

describe("Mobilemandu parser", () => {
  it("normalizes a phone product, stripping the SEO subtitle and extracting RAM/storage from the (ram/storage) shorthand", () => {
    const [product] = parseMobilemanduProduct(phonePage, "https://mobilemandu.com/products/apple-iphone-16-128gb-storage");
    expect(product).toMatchObject({ externalId: "1835", name: "Apple iPhone 16 (128 GB)", brand: "Apple", price: 146599, currency: "NPR", availability: "in_stock" });
  });

  it("marks out-of-stock offers correctly and extracts RAM/storage from the (8/256) shorthand", () => {
    const [product] = parseMobilemanduProduct(outOfStockPage, "https://mobilemandu.com/products/samsung-galaxy-s24-8256-immersive-viewing-and-gaming");
    expect(product).toMatchObject({ name: "Samsung Galaxy S24 (8/256)", brand: "Samsung", availability: "out_of_stock", ram: "8GB", storage: "256GB" });
  });

  it("rejects a non-phone product even though it parses as valid JSON-LD (category check, not just presence)", () => {
    expect(() => parseMobilemanduProduct(tabletPage, "https://mobilemandu.com/products/redmi-pad-pro-5g-8gb-ram-256gb-storage")).toThrow("not a phone product");
  });

  it("rejects pages without a product name", () => {
    expect(() => parseMobilemanduProduct("<html></html>", "https://mobilemandu.com/products/broken")).toThrow("missing product");
  });

  it("selects only smartphone-looking URLs from the sitemap and respects the limit", () => {
    const sitemap = [
      "<loc>https://mobilemandu.com/products/apple-iphone-16-128gb-storage</loc>",
      "<loc>https://mobilemandu.com/products/samsung-galaxy-s24-8256-immersive-viewing-and-gaming</loc>",
      "<loc>https://mobilemandu.com/products/oneplus-buds-2-high-quality-audio-earbuds</loc>",
      "<loc>https://mobilemandu.com/products/asus-vivobook-15-e510ma-n4020-4gb-256ssd</loc>",
      "<loc>https://mobilemandu.com/products/redmi-pad-pro-5g-8gb-ram-256gb-storage</loc>",
      "<loc>https://mobilemandu.com/products/tulip-non-stick-soleplated-dry-iron-vivo-750w-blue</loc>",
    ].join("");
    expect(parseMobilemanduProductUrls(sitemap, 2)).toEqual([
      "https://mobilemandu.com/products/apple-iphone-16-128gb-storage",
      "https://mobilemandu.com/products/samsung-galaxy-s24-8256-immersive-viewing-and-gaming",
    ]);
  });

  it("excludes the earbuds/laptop/tablet/appliance false-positive URLs seen in the real sitemap", () => {
    const sitemap = [
      "<loc>https://mobilemandu.com/products/oneplus-buds-2-high-quality-audio-earbuds</loc>",
      "<loc>https://mobilemandu.com/products/asus-vivobook-15-e510ma-n4020-4gb-256ssd</loc>",
      "<loc>https://mobilemandu.com/products/redmi-pad-pro-5g-8gb-ram-256gb-storage</loc>",
      "<loc>https://mobilemandu.com/products/tulip-non-stick-soleplated-dry-iron-vivo-750w-blue</loc>",
      "<loc>https://mobilemandu.com/products/nothing-eara-black</loc>",
      "<loc>https://mobilemandu.com/products/honorpadx8b</loc>",
    ].join("");
    expect(parseMobilemanduProductUrls(sitemap, 10)).toEqual([]);
  });
});
