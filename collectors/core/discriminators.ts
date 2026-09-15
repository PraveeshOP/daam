/**
 * Hard identity signals pulled straight from a product's raw name.
 *
 * These exist because match *confidence* turned out to be worthless as a safety signal. Measured
 * across 418 real match candidates, the rate at which the two products disagreed on some concrete
 * discriminator went UP with confidence: 70% in the 60-64 band, 75% in 65-69, and 100% in 70-74.
 * The reason is structural — brand (20) + storage (25) + RAM (10) already totals 55 for any two
 * same-brand laptops with the same memory, whether or not they are the same machine, and further
 * points come from more incidental agreement rather than better identity. A confidence floor
 * would therefore admit the *most* wrong merges, not the fewest.
 *
 * So identity is gated on facts instead. Each extractor returns a canonical string, and two
 * products conflict when both state a value for the same signal and those values differ. One side
 * staying silent is never a conflict: catalogue names are inconsistent about what they mention.
 */
export type DiscriminatorName = "capacity" | "chip" | "generation" | "screen" | "model code";

const sorted = (values: string[]) => [...new Set(values)].sort().join(",");

const EXTRACTORS: Record<DiscriminatorName, (name: string) => string> = {
  // "8GB RAM / 512GB SSD" -> "512gb,8gb"
  capacity: (name) => sorted([...name.matchAll(/\b(\d+)\s*(gb|tb)\b/gi)].map((m) => `${m[1]}${m[2].toLowerCase()}`)),
  // Processor family: i5 vs i7, Ryzen 5 vs Ryzen 7, M5 vs M5 Pro, Core Ultra 5 vs 7.
  chip: (name) => sorted([...name.matchAll(/\b(i[3579]|ryzen\s*[3579]|m[1-9](?:\s*(?:pro|max|ultra))?|ultra\s*[3579]|snapdragon\s*\w+|celeron|pentium)\b/gi)].map((m) => m[0].toLowerCase().replace(/\s+/g, " "))),
  // "12th Gen" vs "10TH GEN"
  generation: (name) => sorted([...name.matchAll(/\b(\d{1,2})(?:th|st|nd|rd)\s*gen\b/gi)].map((m) => m[1])),
  // 13.3" / 15.6 inch / 16″. Compared numerically, not as text: the same machine is written
  // "13.0″" in one catalogue entry and "13″" in another, and treating those as a conflict
  // wrongly blocked a genuine 83% match between two listings of the same MacBook Neo.
  screen: (name) => sorted([...name.matchAll(/\b(1[0-9](?:\.\d)?)\s*(?:inch|["”″])/gi)].map((m) => String(parseFloat(m[1])))),
  // Manufacturer part numbers: K513EA, X1503ZA, FA506QM, AC16250.
  "model code": (name) => sorted([...name.matchAll(/\b([A-Z]{1,3}\d{3,5}[A-Z]{0,3})\b/g)].map((m) => m[1].toUpperCase())),
};

/** Which signals both products state, and disagree on. Empty means nothing contradicts. */
export function conflictingDiscriminators(firstName: string, secondName: string): DiscriminatorName[] {
  const conflicts: DiscriminatorName[] = [];
  for (const [name, extract] of Object.entries(EXTRACTORS) as [DiscriminatorName, (value: string) => string][]) {
    const first = extract(firstName);
    const second = extract(secondName);
    if (first && second && first !== second) conflicts.push(name);
  }
  return conflicts;
}

export const hasDiscriminatorConflict = (firstName: string, secondName: string) => conflictingDiscriminators(firstName, secondName).length > 0;
