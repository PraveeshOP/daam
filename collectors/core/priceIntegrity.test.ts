import { describe, expect, it } from "vitest";
import { isSuspiciousPriceChange } from "@/collectors/core/priceIntegrity";

describe("isSuspiciousPriceChange", () => {
  it("is not suspicious when there is no prior price (new offer)", () => {
    expect(isSuspiciousPriceChange(null, 50000)).toBe(false);
  });

  it("is not suspicious for a normal price change", () => {
    expect(isSuspiciousPriceChange(50000, 48000)).toBe(false);
    expect(isSuspiciousPriceChange(50000, 55000)).toBe(false);
  });

  it("flags a price that jumped 10x", () => {
    expect(isSuspiciousPriceChange(5000, 50000)).toBe(true);
  });

  it("flags a price that dropped to a tenth", () => {
    expect(isSuspiciousPriceChange(50000, 5000)).toBe(true);
  });

  it("does not flag right at the boundary ratios", () => {
    expect(isSuspiciousPriceChange(10000, 2000)).toBe(false); // ratio 0.2
    expect(isSuspiciousPriceChange(10000, 50000)).toBe(false); // ratio 5
  });

  it("treats a non-positive prior price as unknown rather than dividing by zero", () => {
    expect(isSuspiciousPriceChange(0, 50000)).toBe(false);
  });
});
