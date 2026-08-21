import { describe, expect, it } from "vitest";
import { parseIttiProduct, parseIttiProductUrls, parseIttiLaptopProduct, parseIttiLaptopUrls, parseIttiCategoryProduct, parseIttiGamingUrls, GAMING_CANONICAL_URL_HINT, GAMING_NAME_FALLBACK_HINT } from "@/collectors/itti/parser";

const payload = { is_product: true, data: { pid: 1789, sku: "iPhone 16 128GB", name: "Apple iPhone 16", short_name: "iPhone 16", description: "<p>Phone</p>", specification: "<table><tr><td>Brand</td><td>Apple</td></tr><tr><td>Model</td><td>iPhone 16</td></tr><tr><td>RAM</td><td>8GB</td></tr><tr><td>Internal Storage</td><td>128GB</td></tr></table>", price: { sku: "iPhone 16 128GB", stock: 0, in_stock: false, selling_price: 141499 }, image: { image: "https://admin.itti.com.np/storage/phone.webp" } } };

const laptopPayload = { is_product: true, data: { pid: 453, sku: "Lenovo Thinkpad X13 intel", name: "Lenovo ThinkPad X13", canonical_url: "https://itti.com.np/laptops-by-brands/lenovo-laptops-nepal/thinkpad", specification: "<table><tr><td>Brand</td><td>Lenovo</td></tr><tr><td>Model</td><td>ThinkPad X13</td></tr><tr><td>RAM</td><td>8GB</td></tr><tr><td>Internal Storage</td><td>512GB</td></tr></table>", price: { in_stock: true, selling_price: 111200 }, image: { image: "https://admin.itti.com.np/storage/laptop.webp" } } };

const desktopPayload = { is_product: true, data: { pid: 999, sku: "Predator Orion 3000", name: "Acer Predator Orion 3000", canonical_url: "https://itti.com.np/gaming-desktops/predator", price: { in_stock: true, selling_price: 250000 } } };

describe("ITTI parser", () => {
  it("normalizes product API data", () => {
    const product = parseIttiProduct(payload, "https://itti.com.np/product/apple-iphone-16-128-price-nepal")[0];
    expect(product).toMatchObject({ externalId: "iPhone 16 128GB", name: "Apple iPhone 16 128GB", brand: "Apple", model: "iPhone 16", storage: "128GB", ram: "8GB", price: 141499, availability: "out_of_stock" });
  });
  it("selects smartphone product URLs", () => {
    expect(parseIttiProductUrls("<loc>https://itti.com.np/product/apple-iphone-16-128-price-nepal</loc><loc>https://itti.com.np/product/apple-iphone-case</loc>", 10)).toEqual(["https://itti.com.np/product/apple-iphone-16-128-price-nepal"]);
  });
});

describe("ITTI laptop parser (§H2, learned from Evo's non-unique-sku bug)", () => {
  it("accepts a real laptop and overrides externalId to the numeric pid, not the free-text sku", () => {
    const product = parseIttiLaptopProduct(laptopPayload, "https://itti.com.np/product/lenovo-thinkpad-x13-price-nepal")[0];
    expect(product).toMatchObject({ externalId: "453", name: "Lenovo ThinkPad X13 512GB", ram: "8GB", storage: "512GB" });
  });
  it("rejects a non-laptop product via canonical_url, even though it parses as a valid product", () => {
    expect(() => parseIttiLaptopProduct(desktopPayload, "https://itti.com.np/product/acer-predator-orion-3000")).toThrow("unexpected category");
  });
  it("selects laptop URLs while excluding desktops, monitors, RAM, and accessories that share vocabulary", () => {
    const sitemap = [
      "<loc>https://itti.com.np/product/lenovo-thinkpad-x13-price-nepal</loc>",
      "<loc>https://itti.com.np/product/acer-predator-orion-3000-gaming-desktop-price-nepal</loc>",
      "<loc>https://itti.com.np/product/acer-nitro-vg271u-gaming-monitor-price-nepal</loc>",
      "<loc>https://itti.com.np/product/transcend-8gb-ddr4-laptop-ram-price-nepal</loc>",
      "<loc>https://itti.com.np/product/acer-predator-gaming-chair-sg-edition-price-nepal</loc>",
    ].join("");
    expect(parseIttiLaptopUrls(sitemap, 10)).toEqual(["https://itti.com.np/product/lenovo-thinkpad-x13-price-nepal"]);
  });
});

const ps5Payload = { is_product: true, data: { pid: 1380, sku: "Sony PlayStation 5", name: "Sony PlayStation 5 Digital Edition Gaming Console", canonical_url: "https://itti.com.np/office-components/consoles/playstation", price: { in_stock: true, selling_price: 79999 }, image: { image: "https://admin.itti.com.np/storage/ps5.webp" } } };
const ps5ProPayload = { is_product: true, data: { pid: 1381, sku: "Sony PlayStation 5", name: "Sony PlayStation 5 Pro", canonical_url: "https://itti.com.np/office-components/consoles/playstation", price: { in_stock: true, selling_price: 129999 } } };

describe("ITTI gaming parser (a third category for a store already in the registry)", () => {
  it("accepts a real console via the generic category-product check, using pid as externalId", () => {
    const product = parseIttiCategoryProduct(ps5Payload, "https://itti.com.np/product/playstation-5-price-nepal", GAMING_CANONICAL_URL_HINT)[0];
    expect(product).toMatchObject({ externalId: "1380", price: 79999 });
  });

  it("gives two consoles with an identical sku distinct externalIds (the same sku-reliability concern as laptops)", () => {
    const a = parseIttiCategoryProduct(ps5Payload, "https://itti.com.np/product/playstation-5-price-nepal", GAMING_CANONICAL_URL_HINT)[0];
    const b = parseIttiCategoryProduct(ps5ProPayload, "https://itti.com.np/product/sony-ps5-pro-price-nepal", GAMING_CANONICAL_URL_HINT)[0];
    expect(a.externalId).not.toBe(b.externalId);
  });

  it("rejects a non-console product via canonical_url", () => {
    expect(() => parseIttiCategoryProduct(laptopPayload, "https://itti.com.np/product/lenovo-thinkpad-x13-price-nepal", GAMING_CANONICAL_URL_HINT)).toThrow("unexpected category");
  });

  it("falls back to a name-based check when canonical_url is missing entirely (verified live: real PS5 Pro/Slim/ROG Ally listings have no breadcrumb at all)", () => {
    const noBreadcrumbPayload = { is_product: true, data: { pid: 1382, sku: "Sony PlayStation 5", name: "Sony PlayStation 5 Slim Disc Edition Gaming Console", canonical_url: "https://itti.com.np/product/sony-playstation-5-ps5-slim-disc-edition-1tb-price-nepal", price: { in_stock: true, selling_price: 95000 } } };
    const product = parseIttiCategoryProduct(noBreadcrumbPayload, "https://itti.com.np/product/sony-playstation-5-ps5-slim-disc-edition-1tb-price-nepal", GAMING_CANONICAL_URL_HINT, GAMING_NAME_FALLBACK_HINT)[0];
    expect(product).toMatchObject({ externalId: "1382", price: 95000 });
  });

  it("the name fallback never overrides a genuinely wrong category — a laptop's name doesn't match the gaming fallback either", () => {
    expect(() => parseIttiCategoryProduct(laptopPayload, "https://itti.com.np/product/lenovo-thinkpad-x13-price-nepal", GAMING_CANONICAL_URL_HINT, GAMING_NAME_FALLBACK_HINT)).toThrow("unexpected category");
  });

  it("selects gaming console URLs while excluding KVM/USB-sharing switches that share the bare word 'switch'", () => {
    const sitemap = [
      "<loc>https://itti.com.np/product/playstation-5-price-nepal</loc>",
      "<loc>https://itti.com.np/product/asus-rog-xbox-ally-2025-price-nepal</loc>",
      "<loc>https://itti.com.np/product/ugreen-kvm-switch-with-2-ports-usb</loc>",
      "<loc>https://itti.com.np/product/ugreen-usb-20-sharing-switch-4x1</loc>",
    ].join("");
    expect(parseIttiGamingUrls(sitemap, 10)).toEqual([
      "https://itti.com.np/product/playstation-5-price-nepal",
      "https://itti.com.np/product/asus-rog-xbox-ally-2025-price-nepal",
    ]);
  });
});
