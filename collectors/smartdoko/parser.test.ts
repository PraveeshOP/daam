import { describe, expect, it } from "vitest";
import { parseSmartdokoProduct, parseSmartdokoProducts, SMARTDOKO_TV_CATEGORY_IDS, type SmartdokoFilteredResponse } from "@/collectors/smartdoko/parser";

/** A trimmed reconstruction of a real SmartDoko /api/products/filtered?category=tvs entry
 * (LG 55 Inch QNED TV), verified live. */
const tv = {
  id: 68702,
  name: "LG 55 Inch QNED TV 55QNED80ASA",
  slug: "lg-55-inch-qned-tv-55qned80asa",
  thumbnail: "https://smartdoko.com/storage/products/thumb/1781158157_7574.jpeg",
  image: { full: "https://smartdoko.com/storage/products/resized/1781158157_7574.jpeg" },
  in_stock: 5,
  sku: "1234",
  price: 211890,
  sale_price: 173090,
  category: { id: 1883, name: "Smart TV" },
  brand: { id: 8, name: "LG" },
  shareLink: "https://smartdoko.com/product/lg-55-inch-qned-tv-55qned80asa",
};

describe("parseSmartdokoProduct (verified live against smartdoko.com — sku is not a real identifier)", () => {
  it("uses the sale price over the list price, and the numeric id (never sku) as external id", () => {
    const product = parseSmartdokoProduct(tv, SMARTDOKO_TV_CATEGORY_IDS);
    expect(product).toMatchObject({ externalId: "68702", name: "LG 55 Inch QNED TV 55QNED80ASA", brand: "LG", price: 173090, currency: "NPR", availability: "in_stock", imageUrl: "https://smartdoko.com/storage/products/resized/1781158157_7574.jpeg" });
  });

  it("falls back to list price when there's no sale price", () => {
    const product = parseSmartdokoProduct({ ...tv, sale_price: 0 }, SMARTDOKO_TV_CATEGORY_IDS);
    expect(product?.price).toBe(211890);
  });

  it("treats in_stock <= 0 as out of stock", () => {
    expect(parseSmartdokoProduct({ ...tv, in_stock: 0 }, SMARTDOKO_TV_CATEGORY_IDS)?.availability).toBe("out_of_stock");
  });

  it("excludes a product outside the allowed TV category ids (e.g. TV wall-mount Accessories, id 1080, nested under the same parent but not a real TV)", () => {
    const wallMount = { ...tv, category: { id: 1080, name: "Accessories" }, name: "Heavy Duty Wall Mount Stand" };
    expect(parseSmartdokoProduct(wallMount, SMARTDOKO_TV_CATEGORY_IDS)).toBeNull();
  });

  it("drops a 'Pre Booking' placeholder listing", () => {
    expect(parseSmartdokoProduct({ ...tv, name: "Pre Booking LG 55 Inch QNED TV" }, SMARTDOKO_TV_CATEGORY_IDS)).toBeNull();
  });

  it("drops a product with no usable positive price", () => {
    expect(parseSmartdokoProduct({ ...tv, price: 0, sale_price: 0 }, SMARTDOKO_TV_CATEGORY_IDS)).toBeNull();
  });
});

describe("parseSmartdokoProducts", () => {
  it("respects the limit and skips filtered-out products without counting them against it", () => {
    const response: SmartdokoFilteredResponse = {
      data: [{ ...tv, id: 1, category: { id: 1080, name: "Accessories" } }, tv, { ...tv, id: 2 }],
      meta: { current_page: 1, last_page: 1, total: 3 },
    };
    const rows = parseSmartdokoProducts(response, SMARTDOKO_TV_CATEGORY_IDS, 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "68702" })]);
  });
});
