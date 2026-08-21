import { evoCollector } from "@/collectors/evo/collector";
import { evoLaptopsCollector } from "@/collectors/evo/laptopsCollector";
import { ittiCollector } from "@/collectors/itti/collector";
import { mobilemanduCollector } from "@/collectors/mobilemandu/collector";
import type { StoreCollector } from "@/collectors/core/types";

/** Every automated/manual collection entry point (worker, CLI scripts) looks stores up here.
 * More than one entry can point at the same `store.slug` (evoCollector and evoLaptopsCollector
 * both feed the one "evo-store" row) — this record is keyed by collector/job identity, not by
 * store identity. */
export const COLLECTORS: Record<string, StoreCollector> = {
  [evoCollector.storeId]: evoCollector,
  [evoLaptopsCollector.storeId]: evoLaptopsCollector,
  [ittiCollector.storeId]: ittiCollector,
  [mobilemanduCollector.storeId]: mobilemanduCollector,
};

export const STORE_IDS = Object.keys(COLLECTORS);

export function getCollector(storeId: string): StoreCollector {
  const collector = COLLECTORS[storeId];
  if (!collector) throw new Error(`unknown storeId "${storeId}" (known stores: ${STORE_IDS.join(", ")})`);
  return collector;
}
