import { evoCollector } from "@/collectors/evo/collector";
import { ittiCollector } from "@/collectors/itti/collector";
import { mobilemanduCollector } from "@/collectors/mobilemandu/collector";
import type { StoreCollector } from "@/collectors/core/types";

/** Every automated/manual collection entry point (worker, CLI scripts) looks stores up here. */
export const COLLECTORS: Record<string, StoreCollector> = {
  [evoCollector.storeId]: evoCollector,
  [ittiCollector.storeId]: ittiCollector,
  [mobilemanduCollector.storeId]: mobilemanduCollector,
};

export const STORE_IDS = Object.keys(COLLECTORS);

export function getCollector(storeId: string): StoreCollector {
  const collector = COLLECTORS[storeId];
  if (!collector) throw new Error(`unknown storeId "${storeId}" (known stores: ${STORE_IDS.join(", ")})`);
  return collector;
}
