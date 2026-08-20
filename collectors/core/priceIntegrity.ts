/**
 * §H1 (phase-9 audit): a scraped price could be wrong in ways that are still a positive,
 * finite number — a decimal-point slip, an installment/EMI price picked up instead of the full
 * price, a currency mixup. None of that is caught by the parsers' existing "reject <= 0" checks.
 * This never blocks a write (a real, if unusual, price change should never be silently dropped —
 * that would just create a different kind of data-integrity bug) — it only flags the change so
 * it surfaces for admin review, the same "flag, don't crash" pattern already used for uncertain
 * product matches (collectors/core/matcher.ts).
 */
const SUSPICIOUS_RATIO_LOW = 0.2;
const SUSPICIOUS_RATIO_HIGH = 5;

export function isSuspiciousPriceChange(oldPrice: number | null, newPrice: number): boolean {
  if (oldPrice === null || oldPrice <= 0) return false;
  const ratio = newPrice / oldPrice;
  return ratio < SUSPICIOUS_RATIO_LOW || ratio > SUSPICIOUS_RATIO_HIGH;
}
