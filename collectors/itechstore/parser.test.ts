import { describe, expect, it } from "vitest";
import { extractCategorySlugs, parseItechstoreVariantDetail, dedupeVariantsByTitle, type ItechstoreCategory, type ItechstoreProductDetail } from "@/collectors/itechstore/parser";

describe("dedupeVariantsByTitle (iPhone 16 Pro has 16 color×storage variants — verified live that same-storage colors share one price)", () => {
  it("keeps only the first variant per distinct storage-tier title", () => {
    const variants = [
      { id: 1636, title: "128GB", slug: "128gb", color: 102 },
      { id: 1637, title: "128GB", slug: "128gb-n", color: 103 },
      { id: 1638, title: "256GB", slug: "256gb", color: 102 },
    ];
    expect(dedupeVariantsByTitle(variants)).toEqual([variants[0], variants[2]]);
  });
});

describe("extractCategorySlugs", () => {
  it("reads product slugs straight from the category endpoint, respecting the limit", () => {
    const category: ItechstoreCategory = {
      slug: "phones-tablets-e-reader",
      name: "Phones, Tablets & eReaders",
      products: [
        { id: 548, title: "Apple IPhone 16 Pro", slug: "iphone-16-pro", variant_count: 16 },
        { id: 425, title: "Apple iPhone 15", slug: "apple-iphone-15", variant_count: 8 },
        { id: 532, title: "iPhone 16", slug: "iphone-16", variant_count: 3 },
      ],
    };
    expect(extractCategorySlugs(category, 2)).toEqual(["iphone-16-pro", "apple-iphone-15"]);
  });
});

describe("parseItechstoreVariantDetail (real per-variant fields verified live against ibe.itechstore.com.np)", () => {
  const base: ItechstoreProductDetail = {
    id: 532,
    is_purchasable: true,
    brand: { slug: "apple", name: "Apple" },
    title: "iPhone 16",
    thumbnail: { src: "product/variants/c61dc21d-2e12-47aa-aece-bf176b1bddbe/iphone-16-color.png" },
    sku: "APL-CE65209F",
    price: 130200,
    offer_price: 0,
    colors: [{ id: 100, name: "ultramarine" }],
    selected_variant: { id: 1608, title: "128GB", slug: "iphone-16-ultramarine-128GB", color: 100 },
  };

  it("builds a name from title + variant title, using price over 0-valued offer_price", () => {
    const product = parseItechstoreVariantDetail(base, "https://itechstore.com.np/product/iphone-16");
    expect(product).toMatchObject({ externalId: "532-1608", name: "iPhone 16 128GB", brand: "Apple", color: "ultramarine", storage: "128GB", price: 130200, currency: "NPR", availability: "in_stock" });
  });

  it("prefers a real offer_price over the list price when one is set", () => {
    const product = parseItechstoreVariantDetail({ ...base, offer_price: 119999 }, "https://itechstore.com.np/product/iphone-16");
    expect(product?.price).toBe(119999);
  });

  it("does not use JSON-LD-style availability — reads is_purchasable directly, including the false case", () => {
    const product = parseItechstoreVariantDetail({ ...base, is_purchasable: false }, "https://itechstore.com.np/product/x");
    expect(product?.availability).toBe("out_of_stock");
  });

  it("drops a variant with no usable price (price 0 and no offer_price) rather than inventing one", () => {
    const product = parseItechstoreVariantDetail({ ...base, price: 0, offer_price: 0 }, "https://itechstore.com.np/product/x");
    expect(product).toBeNull();
  });

  it("does not append a 'Default' variant title onto the name for single-variant products", () => {
    const product = parseItechstoreVariantDetail({ ...base, selected_variant: { id: 225, title: "Default", slug: "default" }, colors: [] }, "https://itechstore.com.np/product/x");
    expect(product?.name).toBe("iPhone 16");
  });
});
