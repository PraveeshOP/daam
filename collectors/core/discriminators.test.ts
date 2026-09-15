import { describe, expect, it } from "vitest";
import { conflictingDiscriminators, hasDiscriminatorConflict } from "@/collectors/core/discriminators";

/**
 * Every pair here is real: taken from the 418 match candidates in the live catalogue, or from the
 * merges an admin bulk-accepted that turned out to be wrong.
 */
describe("discriminator conflicts", () => {
  it("catches differing capacities", () => {
    expect(conflictingDiscriminators("Poco F3 6 Gb Ram, 128Gb Blue", "Poco F3 8 Gb Ram, 256Gb Blue")).toEqual(["capacity"]);
  });

  it("catches a differing processor", () => {
    expect(conflictingDiscriminators(
      "Lenovo ThinkPad Z13 Gen 1 Ryzen 7 PRO 6850U | 16GB RAM | 512GB SSD",
      "Lenovo ThinkPad E14 i5 12th Gen / 16GB RAM / 512GB SSD",
    )).toContain("chip");
  });

  it("catches a differing manufacturer part number", () => {
    expect(conflictingDiscriminators(
      "Asus VivoBook 15 K513EA i5 11th Gen | 8GB RAM | 512GB",
      "Asus VivoBook 15X OLED 2023 X1503ZA i5 | 8GB RAM | 512GB",
    )).toContain("model code");
  });

  it("catches a differing CPU generation", () => {
    expect(conflictingDiscriminators("Acer Predator 2022 i7 11TH GEN", "Acer Predator 2020 i7 10TH GEN")).toContain("generation");
  });

  it("catches a differing screen size", () => {
    expect(conflictingDiscriminators('Lenovo IdeaPad 14" FHD', 'Lenovo IdeaPad 15.6" FHD')).toContain("screen");
  });

  /**
   * Regression: "13.0″" and "13″" are the same screen. Comparing the raw text treated them as a
   * conflict and blocked a genuine 83% match between two catalogue entries for one MacBook Neo.
   */
  it("treats 13.0 inch and 13 inch as the same screen", () => {
    expect(conflictingDiscriminators('MacBook Neo 13.0″ Liquid Retina', 'MacBook Neo 13″ Liquid Retina')).toEqual([]);
  });

  it("does not conflict when only one side states a signal", () => {
    // Catalogue names are wildly inconsistent about what they mention; silence is not disagreement.
    expect(conflictingDiscriminators("Asus TUF A15 FA506QM Ryzen 7 5800H 16GB 512GB", "Asus TUF A15 2021 FA506QM | Ryzen 7 5800H")).toEqual([]);
    expect(conflictingDiscriminators("iPhone 17", "iPhone 17 256GB")).toEqual([]);
  });

  it("allows the genuine same-product pairs the matcher should still merge", () => {
    for (const [first, second] of [
      ["Acer Nitro 5 2020 i7 10th Gen | 16GB RAM | 512GB SSD", "Acer Nitro 5 2020 i7 10TH GEN GTX 1660ti 16GB RAM 512GB SSD"],
      ["HP Pavilion X360 13 2022 12th Gen Intel Core i5 | 8GB RAM | 512GB", "HP Pavilion X360 13 2022 i5 12th Gen / 8GB RAM / 512GB SSD"],
      ["Dell Alienware 16 Aurora AC16250 | Intel Core i9 | 32GB RAM | 1TB", "Dell Alienware 16 Aurora AC16250 | Core i9 | 32GB RAM | 1TB"],
    ]) {
      expect(hasDiscriminatorConflict(first, second), `${first} vs ${second}`).toBe(false);
    }
  });

  it("reports every signal that disagrees, not just the first", () => {
    const conflicts = conflictingDiscriminators(
      'Lenovo IdeaPad Slim 1 Ryzen 3 7320U | 8GB RAM | 256GB SSD | 14" FHD',
      'Lenovo Ideapad 3 15 2021 Ryzen 5 5500U / 8GB RAM / 256GB SSD / 15.6" FHD',
    );
    expect(conflicts).toContain("chip");
    expect(conflicts).toContain("screen");
  });
});
