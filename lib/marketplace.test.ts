import { describe, expect, it } from "vitest";
import { CONDITION_LABELS, marketplaceSourceName, tallyCategories } from "@/lib/marketplace";

describe("marketplace read layer", () => {
  it("orders category chips by count, then alphabetically for a stable tie-break", () => {
    expect(
      tallyCategories([
        { source_category: "Laptops" },
        { source_category: "Storage & Optical Drives" },
        { source_category: "Laptops" },
        { source_category: "Storage & Optical Drives" },
        { source_category: "Audio" },
        { source_category: "Storage & Optical Drives" },
      ]),
    ).toEqual([
      { name: "Storage & Optical Drives", count: 3 },
      { name: "Laptops", count: 2 },
      { name: "Audio", count: 1 },
    ]);
  });

  it("omits rows with no category rather than rendering a blank chip", () => {
    expect(tallyCategories([{ source_category: null }, { source_category: "Laptops" }])).toEqual([{ name: "Laptops", count: 1 }]);
  });

  it("handles an empty table", () => {
    expect(tallyCategories([])).toEqual([]);
  });

  it("labels a known source, and falls back to the slug for an unknown one", () => {
    expect(marketplaceSourceName("hamrobazaar")).toBe("HamroBazaar");
    expect(marketplaceSourceName("some-future-source")).toBe("some-future-source");
  });

  it("has a human label for every condition the schema's check constraint allows", () => {
    for (const condition of ["brand_new", "like_new", "used", "unknown"]) {
      expect(CONDITION_LABELS[condition]).toBeTruthy();
    }
  });
});
