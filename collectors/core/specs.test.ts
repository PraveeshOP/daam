import { describe, expect, it } from "vitest";
import { extractLaptopRamStorage } from "@/collectors/core/specs";

describe("extractLaptopRamStorage", () => {
  it("§close-figures-cross-match regression: does not let storage jump back to the RAM figure when the two are close together (found live on Maxell's 'Acer NITRO 5 ... 8GB RAM, 256GB SSD')", () => {
    expect(extractLaptopRamStorage("Acer NITRO 5 10th Gen i5-10300H, 8GB RAM, 256GB SSD 15.6\" FULL HD 60hz")).toEqual({ ram: "8GB", storage: "256GB" });
  });

  it("handles descriptive words between the figure and its keyword (Yantra Nepal's 'DDR5 4800MHz RAM' / 'Gen 4 NVMe SSD')", () => {
    expect(extractLaptopRamStorage("Dell Inspiron 14 Plus 7440 | Intel Ultra 7 155H, 16GB LPDDR5X 6400MHz RAM, 1TB Gen 4 NVMe SSD")).toEqual({ ram: "16GB", storage: "1TB" });
  });

  it("handles a pipe-separated format (Techinn's '16GB DDR5 RAM | 512GB NVMe SSD')", () => {
    expect(extractLaptopRamStorage("Lenovo Ideapad Slim 3 | 16GB DDR5 RAM | 512GB NVMe SSD | 15.3in Display")).toEqual({ ram: "16GB", storage: "512GB" });
  });

  it("handles storage written before RAM (word order shouldn't matter)", () => {
    expect(extractLaptopRamStorage("Some Laptop 512GB SSD, 16GB RAM")).toEqual({ ram: "16GB", storage: "512GB" });
  });

  it("returns undefined for whichever spec isn't present, without throwing", () => {
    expect(extractLaptopRamStorage("A Laptop With No Specs Listed")).toEqual({ ram: undefined, storage: undefined });
  });
});
