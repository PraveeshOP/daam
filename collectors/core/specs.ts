/**
 * Extracts RAM/storage from laptop-style names like "16GB DDR5 4800MHz RAM, 512GB Gen 4 NVMe SSD"
 * — used by collectors/{yantranepal,techinn,infotechsnepal,computerplanet,maxell}/parser.ts, all
 * unrelated Nepal laptop retailers that happened to converge on this exact naming convention
 * (a GB/TB figure, some descriptive words, then a "RAM"/"SSD"-type keyword) independently. Factored
 * out here once it hit 5 near-identical copies — the same "one duplication too many" threshold
 * that justified collectors/mobilemandu/createCategoryCollector.ts earlier this project.
 *
 * §close-figures-cross-match (found live on Maxell's "8GB RAM, 256GB SSD"): a naive
 * `(\d+gb)(?:\s+\S+){0,2}?\s*ssd\b` lets the storage regex start at the EARLIER "8GB" (RAM) figure
 * and "jump over" the real "256GB" storage figure to reach "SSD", when the two figures are close
 * enough together (within the intervening-word bound) — wrongly capturing "8GB" as storage. The
 * negative lookahead below blocks skipping over any token that is itself another GB/TB figure, so
 * a match can only ever anchor on the GB/TB figure that's actually nearest its keyword.
 */
function extractSpec(name: string, keyword: RegExp): string | undefined {
  const pattern = new RegExp(`(\\d+(?:\\.\\d+)?\\s*(?:gb|tb))(?:\\s+(?!\\d+\\s*(?:gb|tb)\\b)\\S+){0,2}?\\s*${keyword.source}\\b`, "i");
  return name.match(pattern)?.[1]?.replace(/\s+/g, "").toUpperCase();
}

export function extractLaptopRamStorage(name: string): { ram?: string; storage?: string } {
  return {
    ram: extractSpec(name, /ram/),
    storage: extractSpec(name, /(?:ssd|hdd|nvme|emmc)/),
  };
}
