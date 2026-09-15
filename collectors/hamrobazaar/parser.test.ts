import { describe, expect, it } from "vitest";
import { cleanListingTitle, inferBrandFromTitle, extractFlightPayload, extractItemObjects, parseHamrobazaarListings, parseListingTimestamp } from "@/collectors/hamrobazaar/parser";

/**
 * A trimmed-down reconstruction of the real homepage structure verified live on
 * hamrobazaar.com (2026-09-14): listing objects arrive inside a React Server Component flight
 * payload that is split across ~164 `self.__next_f.push([1,"<json string literal>"])` calls,
 * each one a separately-escaped JSON string.
 */
function buildFlightHtml(chunks: string[]) {
  const pushes = chunks.map((chunk) => `<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`).join("\n");
  return `<html><body>${pushes}</body></html>`;
}

/** Field-for-field shape of a real listing, including the seller-identity fields the parser must
 * drop and the empty `brandName` that was empty on all 80 listings sampled live. */
function rawListing(overrides: Record<string, unknown> = {}) {
  return {
    id: "563761F9-88BE-43C4-A5C9-832F24E539EA",
    ad_Id: "HB-563761",
    brandName: "",
    categoryName: "Mobile Phone Handsets",
    condition: 2,
    createdOn: "2026-09-14 15:18:56.3660000",
    creatorInfo: { createdByName: "Sajid", createdByUsername: "9851131786", hidePhoneNumber: false },
    description: "Selling my phone. Call 9851161743",
    location: { locationDescription: "Bu******ur" },
    name: "samsung galaxy s25 ultra 12gb 256gb",
    negotiable: true,
    price: 113500,
    image: "https://hamrobazaar.blr1.cdn.digitaloceanspaces.com/User/Posts/a.jpeg",
    badge: { variant: "like-new", text: "Like New" },
    ...overrides,
  };
}

const wrap = (...listings: object[]) => listings.map((listing) => `{"id":"x","content":["$","$L9c",null,{"item":${JSON.stringify(listing)}}]}`).join(",");

describe("HamroBazaar parser (RSC flight payload — the only robots-allowed listing source)", () => {
  it("reassembles listings that straddle a chunk boundary, which a scan of the raw HTML would miss", () => {
    const whole = wrap(rawListing());
    const splitAt = Math.floor(whole.length / 2);
    const { listings } = parseHamrobazaarListings(buildFlightHtml([`a:[${whole.slice(0, splitAt)}`, `${whole.slice(splitAt)}]`]));
    expect(listings).toHaveLength(1);
    expect(listings[0].title).toBe("samsung galaxy s25 ultra 12gb 256gb");
    expect(listings[0].price).toBe(113500);
  });

  it("never returns seller name, phone number or free-text description", () => {
    const { listings } = parseHamrobazaarListings(buildFlightHtml([`a:[${wrap(rawListing())}]`]));
    const serialized = JSON.stringify(listings);
    expect(serialized).not.toContain("Sajid");
    expect(serialized).not.toContain("9851131786");
    expect(serialized).not.toContain("9851161743");
    expect(Object.keys(listings[0])).not.toContain("description");
  });

  it("maps the condition enum using the meanings the site's own badge text confirms", () => {
    const html = buildFlightHtml([`a:[${wrap(
      rawListing({ id: "A", condition: 1 }),
      rawListing({ id: "B", condition: 2 }),
      rawListing({ id: "C", condition: 3 }),
      rawListing({ id: "D", condition: 99 }),
    )}]`]);
    const { listings } = parseHamrobazaarListings(html);
    expect(listings.map((listing) => listing.condition)).toEqual(["brand_new", "like_new", "used", "unknown"]);
  });

  it("infers the brand from the title, since brandName is empty on every real listing", () => {
    const { listings } = parseHamrobazaarListings(buildFlightHtml([`a:[${wrap(rawListing())}]`]));
    expect(listings[0].brand).toBe("Samsung");
  });

  it("prefers the source's own brandName when it is ever populated", () => {
    const html = buildFlightHtml([`a:[${wrap(rawListing({ brandName: "Samsung Electronics" }))}]`]);
    expect(parseHamrobazaarListings(html).listings[0].brand).toBe("Samsung Electronics");
  });

  /**
   * The bar for adding a rule: a wrong brand is worse than none, because it manufactures the
   * matcher's +20 brand bonus and can push a wrong candidate over the >=75 link threshold.
   */
  it("leaves brand undefined when no rule matches, rather than guessing", () => {
    expect(inferBrandFromTitle("Huidu A3L Video Processor")).toBeUndefined();
    expect(inferBrandFromTitle("1 TB USB portable drive")).toBeUndefined();
  });

  it("maps the real titles seen live to the right brands", () => {
    expect(inferBrandFromTitle("Iphone 17 256gb")).toBe("Apple");
    expect(inferBrandFromTitle("Macbook Pro M5 24/1TB")).toBe("Apple");
    // Resellers omit the brand word on Samsung flagships entirely; the S-series rule covers it.
    expect(inferBrandFromTitle("S26 ultra 256gb>>")).toBe("Samsung");
    expect(inferBrandFromTitle("S25+ 512gb")).toBe("Samsung");
    // ...but only when an S-series tier word follows, so a stray model code cannot trigger it.
    expect(inferBrandFromTitle("Bose S26 speaker")).toBeUndefined();
    expect(inferBrandFromTitle("SanDisk Ultra Fit USB 3.2 Flash Drive 128gb")).toBe("SanDisk");
    expect(inferBrandFromTitle("Cruzer Glide 3.0 USB Flash Drive - 128GB")).toBe("SanDisk");
    expect(inferBrandFromTitle("1 TB USB SEAGATE HDD USB 3.1 BRAND NEW")).toBe("Seagate");
    expect(inferBrandFromTitle("UGREEN 2 Meter 240W Max Type-C")).toBe("UGREEN");
    expect(inferBrandFromTitle("JBL Clip 5 Portable Bluetooth Speaker")).toBe("JBL");
  });

  it("de-duplicates the same advert appearing twice (a boosted slot plus its ordinary feed position)", () => {
    const { listings } = parseHamrobazaarListings(buildFlightHtml([`a:[${wrap(rawListing(), rawListing())}]`]));
    expect(listings).toHaveLength(1);
  });

  it("filters to the requested source categories, since the feed is chronological across the whole site", () => {
    const html = buildFlightHtml([`a:[${wrap(
      rawListing({ id: "A", categoryName: "Mobile Phone Handsets" }),
      rawListing({ id: "B", categoryName: "Cars" }),
      rawListing({ id: "C", categoryName: "Pet - Dogs" }),
    )}]`]);
    const { listings } = parseHamrobazaarListings(html, { categories: ["Mobile Phone Handsets"] });
    expect(listings.map((listing) => listing.externalId)).toEqual(["A"]);
  });

  it("filters to the requested conditions, keeping only sealed stock when asked for brand_new", () => {
    const html = buildFlightHtml([`a:[${wrap(
      rawListing({ id: "A", condition: 1 }),
      rawListing({ id: "B", condition: 2 }),
      rawListing({ id: "C", condition: 3 }),
    )}]`]);
    const { listings } = parseHamrobazaarListings(html, { conditions: ["brand_new"] });
    expect(listings.map((listing) => listing.externalId)).toEqual(["A"]);
  });

  it("does not treat 'like_new' as new — it is the site's second-hand-but-good condition 2", () => {
    const html = buildFlightHtml([`a:[${wrap(rawListing({ id: "B", condition: 2 }))}]`]);
    expect(parseHamrobazaarListings(html, { conditions: ["brand_new"] }).listings).toEqual([]);
  });

  it("counts a filtered-out listing as filtered, not skipped, so skipped stays a drift signal", () => {
    const html = buildFlightHtml([`a:[${wrap(rawListing({ id: "A", condition: 1 }), rawListing({ id: "B", condition: 3 }))}]`]);
    expect(parseHamrobazaarListings(html, { conditions: ["brand_new"] }).skipped).toBe(0);
  });

  it("applies the category and condition filters together", () => {
    const html = buildFlightHtml([`a:[${wrap(
      rawListing({ id: "A", categoryName: "Laptops", condition: 1 }),
      rawListing({ id: "B", categoryName: "Laptops", condition: 3 }),
      rawListing({ id: "C", categoryName: "Cars", condition: 1 }),
    )}]`]);
    const { listings } = parseHamrobazaarListings(html, { categories: ["Laptops"], conditions: ["brand_new"] });
    expect(listings.map((listing) => listing.externalId)).toEqual(["A"]);
  });

  it("strips the reseller '>>' title padding seen on 5 of 12 real listings", () => {
    expect(cleanListingTitle("Iphone 17 256gb>>Iphone 17 256gb>>Iphone 17 256gb>")).toBe("Iphone 17 256gb");
    expect(cleanListingTitle("Macbook Pro m5 pro 24/1TB>>Macbook pro m5 pro 1TB>")).toBe("Macbook Pro m5 pro 24/1TB");
    expect(cleanListingTitle("Macbook Pro M5 16/1TB>>Macbook Pro M5 16/1TB>>")).toBe("Macbook Pro M5 16/1TB");
  });

  it("leaves a single '>' alone, since it appears in genuine titles", () => {
    expect(cleanListingTitle("USB Type-C > HDMI adapter")).toBe("USB Type-C > HDMI adapter");
  });

  it("never returns an empty title even if the padding is all there is", () => {
    expect(cleanListingTitle(">>>>")).toBe(">>>>");
  });

  it("applies the title cleanup to parsed listings", () => {
    const html = buildFlightHtml([`a:[${wrap(rawListing({ name: "Iphone 17 256gb>>Iphone 17 256gb>" }))}]`]);
    expect(parseHamrobazaarListings(html).listings[0].title).toBe("Iphone 17 256gb");
  });

  it("builds the verified-working short detail URL", () => {
    const { listings } = parseHamrobazaarListings(buildFlightHtml([`a:[${wrap(rawListing())}]`]));
    expect(listings[0].listingUrl).toBe("https://hamrobazaar.com/detail/563761F9-88BE-43C4-A5C9-832F24E539EA");
  });

  it("skips a listing with a non-positive price but keeps the rest of the batch", () => {
    const html = buildFlightHtml([`a:[${wrap(rawListing({ id: "A" }), rawListing({ id: "B", price: 0 }))}]`]);
    const { listings, skipped } = parseHamrobazaarListings(html);
    expect(listings.map((listing) => listing.externalId)).toEqual(["A"]);
    expect(skipped).toBe(1);
  });

  it("keeps a low car price as-is — sellers write lakhs there, so rescaling would corrupt honest rows", () => {
    const html = buildFlightHtml([`a:[${wrap(rawListing({ id: "A", categoryName: "Cars", name: "Mahindra XUV500 W10(2016)", price: 31.5 }))}]`]);
    const { listings } = parseHamrobazaarListings(html);
    expect(listings[0].price).toBe(31.5);
  });

  it("brace-matches around braces inside seller-written free text", () => {
    const html = buildFlightHtml([`a:[${wrap(rawListing({ description: 'price {negotiable} "quoted" }}}' }))}]`]);
    const { listings } = parseHamrobazaarListings(html);
    expect(listings).toHaveLength(1);
    expect(listings[0].title).toBe("samsung galaxy s25 ultra 12gb 256gb");
  });

  it("survives one unparseable chunk instead of losing the whole page", () => {
    const html = `<html><body><script>self.__next_f.push([1,"broken)</script><script>self.__next_f.push([1,${JSON.stringify(`a:[${wrap(rawListing())}]`)}])</script></body></html>`;
    expect(parseHamrobazaarListings(html).listings).toHaveLength(1);
  });

  it("returns nothing, rather than throwing, when the payload has no listings at all", () => {
    expect(parseHamrobazaarListings(buildFlightHtml(['1:I[210291,["/_next/static/chunks/x.js"]]']))).toEqual({ listings: [], skipped: 0 });
  });

  it("normalizes the 7-fractional-digit, space-separated timestamp that new Date() rejects", () => {
    expect(parseListingTimestamp("2026-09-14 15:18:56.3660000")).toBe("2026-09-14T15:18:56.366Z");
    expect(parseListingTimestamp("not a date")).toBeUndefined();
    expect(parseListingTimestamp(undefined)).toBeUndefined();
  });

  it("stops cleanly at a truncated object instead of hanging or throwing", () => {
    expect(extractItemObjects('"item":{"id":"A","nested":{"x":1}')).toEqual([]);
  });

  it("concatenates chunks in document order", () => {
    expect(extractFlightPayload(buildFlightHtml(["one", "two", "three"]))).toBe("onetwothree");
  });
});
