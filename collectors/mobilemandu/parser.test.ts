import { describe, expect, it } from "vitest";
import {
  parseMobilemanduProduct,
  parseMobilemanduProductUrls,
  parseMobilemanduLaptopUrls,
  filterMobilemanduUrls,
  LAPTOP_CATEGORY,
  AUDIO_CATEGORY,
  TV_CATEGORY,
  SMARTWATCH_CATEGORY,
  APPLIANCE_CATEGORY,
  AUDIO_URL_HINT,
  AUDIO_URL_EXCLUDE,
  TV_URL_HINT,
  TV_URL_EXCLUDE,
} from "@/collectors/mobilemandu/parser";

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
    expect(() => parseMobilemanduProduct(tabletPage, "https://mobilemandu.com/products/redmi-pad-pro-5g-8gb-ram-256gb-storage")).toThrow("unexpected category");
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

const laptopPage = `<script type="application/ld+json">${JSON.stringify({
  "@type": "Product",
  name: "Acer Aspire 5 | Windows 11 Home",
  sku: "1314",
  brand: { name: "Acer" },
  category: "Laptops",
  offers: { url: "https://mobilemandu.com/products/acer-aspire-5-i7-1355u-8512-gb-156-fhd-windows-11-home-a515-58m-77xv", priceCurrency: "NPR", price: "89999.00", availability: "https://schema.org/InStock" },
})}</script>`;

describe("Mobilemandu laptop parser (a second category for a store already in the registry)", () => {
  it("accepts a real laptop when the expected category is passed explicitly", () => {
    const [product] = parseMobilemanduProduct(laptopPage, "https://mobilemandu.com/products/acer-aspire-5-i7-1355u-8512-gb-156-fhd-windows-11-home-a515-58m-77xv", LAPTOP_CATEGORY);
    expect(product).toMatchObject({ externalId: "1314", name: "Acer Aspire 5", brand: "Acer", price: 89999 });
  });

  it("rejects a phone when the expected category is laptops (the category check is symmetric, not phone-only)", () => {
    expect(() => parseMobilemanduProduct(phonePage, "https://mobilemandu.com/products/apple-iphone-16-128gb-storage", LAPTOP_CATEGORY)).toThrow("unexpected category");
  });

  it("selects laptop-looking URLs while excluding smartwatches/keyboards/cables whose slug merely mentions 'laptop'", () => {
    const sitemap = [
      "<loc>https://mobilemandu.com/products/acer-aspire-5-i7-1355u-8512-gb-156-fhd-windows-11-home-a515-58m-77xv</loc>",
      "<loc>https://mobilemandu.com/products/apple-macbook-air-m2-13-inch-16256gb</loc>",
      "<loc>https://mobilemandu.com/products/aluminum-alloy-metal-adjustable-laptop-stand</loc>",
      "<loc>https://mobilemandu.com/products/womens-smartwatch-l68b-waterproof-bracelet</loc>",
      "<loc>https://mobilemandu.com/products/bavin-cb392-4-in-1-240w-fast-charging-data-cable-for-laptop-support-480mbps-data-transfer-for-smartphones</loc>",
    ].join("");
    expect(parseMobilemanduLaptopUrls(sitemap, 10)).toEqual([
      "https://mobilemandu.com/products/acer-aspire-5-i7-1355u-8512-gb-156-fhd-windows-11-home-a515-58m-77xv",
      "https://mobilemandu.com/products/apple-macbook-air-m2-13-inch-16256gb",
    ]);
  });
});

describe("Mobilemandu category regexes (Audio/TVs/Smartwatches/Home appliances — granular type strings, not broad buckets)", () => {
  it("AUDIO_CATEGORY matches every real audio type string seen live, not just one", () => {
    expect(AUDIO_CATEGORY.test("Speaker")).toBe(true);
    expect(AUDIO_CATEGORY.test("Wireless Headphone")).toBe(true);
    expect(AUDIO_CATEGORY.test("Wired Headphone")).toBe(true);
    expect(AUDIO_CATEGORY.test("SmartWatch")).toBe(false);
  });

  it("TV_CATEGORY matches only the exact 'TV' type, not an unrelated category that happens to contain the letters", () => {
    expect(TV_CATEGORY.test("TV")).toBe(true);
    expect(TV_CATEGORY.test("Activity")).toBe(false);
  });

  it("SMARTWATCH_CATEGORY matches both the plain and 'Kids' variants seen live", () => {
    expect(SMARTWATCH_CATEGORY.test("SmartWatch")).toBe(true);
    expect(SMARTWATCH_CATEGORY.test("Kids SmartWatch")).toBe(true);
  });

  it("APPLIANCE_CATEGORY matches the specific appliance types seen live", () => {
    expect(APPLIANCE_CATEGORY.test("Washing Machine")).toBe(true);
    expect(APPLIANCE_CATEGORY.test("Refrigerator")).toBe(true);
    expect(APPLIANCE_CATEGORY.test("Vacuum Cleaner")).toBe(true);
    expect(APPLIANCE_CATEGORY.test("Speaker")).toBe(false);
  });

  it("parseMobilemanduProduct accepts a real speaker against AUDIO_CATEGORY and rejects a smartwatch", () => {
    const speakerPage = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Product", name: "LG 1800W X Boom Speaker", sku: "9001", brand: { name: "LG" }, category: "Speaker",
      offers: { url: "https://mobilemandu.com/products/lg-1800-w-x-boom-speaker", priceCurrency: "NPR", price: "12999.00", availability: "https://schema.org/InStock" },
    })}</script>`;
    const [product] = parseMobilemanduProduct(speakerPage, "https://mobilemandu.com/products/lg-1800-w-x-boom-speaker", AUDIO_CATEGORY);
    expect(product).toMatchObject({ externalId: "9001", brand: "LG", price: 12999 });
    expect(() => parseMobilemanduProduct(speakerPage, "https://mobilemandu.com/products/lg-1800-w-x-boom-speaker", TV_CATEGORY)).toThrow("unexpected category");
  });

  it("filterMobilemanduUrls applies the hint/exclude pair generically (used for Audio/TVs/Smartwatches/Home appliances)", () => {
    const sitemap = [
      "<loc>https://mobilemandu.com/products/hifuture-tour-over-ear-anc-headphones</loc>",
      "<loc>https://mobilemandu.com/products/x-age-earbud-carrying-case-cover</loc>",
    ].join("");
    expect(filterMobilemanduUrls(sitemap, AUDIO_URL_HINT, AUDIO_URL_EXCLUDE, 10)).toEqual([
      "https://mobilemandu.com/products/hifuture-tour-over-ear-anc-headphones",
    ]);
  });

  it("TV_URL_HINT/EXCLUDE keep real TVs while dropping TV boxes, stands, and remotes", () => {
    const sitemap = [
      "<loc>https://mobilemandu.com/products/tcl-65-inch-4k-uhd-tv-65v6b-voice-commands</loc>",
      "<loc>https://mobilemandu.com/products/generic-tv-stand-table</loc>",
      "<loc>https://mobilemandu.com/products/apple-tv-4k-streaming-device</loc>",
    ].join("");
    expect(filterMobilemanduUrls(sitemap, TV_URL_HINT, TV_URL_EXCLUDE, 10)).toEqual([
      "https://mobilemandu.com/products/tcl-65-inch-4k-uhd-tv-65v6b-voice-commands",
    ]);
  });
});
