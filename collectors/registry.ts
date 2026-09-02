import { evoCollector } from "@/collectors/evo/collector";
import { evoLaptopsCollector } from "@/collectors/evo/laptopsCollector";
import { ittiCollector } from "@/collectors/itti/collector";
import { ittiLaptopsCollector } from "@/collectors/itti/laptopsCollector";
import { ittiGamingCollector } from "@/collectors/itti/gamingCollector";
import { mobilemanduCollector } from "@/collectors/mobilemandu/collector";
import { mobilemanduLaptopsCollector } from "@/collectors/mobilemandu/laptopsCollector";
import { mobilemanduAudioCollector } from "@/collectors/mobilemandu/audioCollector";
import { mobilemanduTvCollector } from "@/collectors/mobilemandu/tvCollector";
import { mobilemanduSmartwatchCollector } from "@/collectors/mobilemandu/smartwatchCollector";
import { mobilemanduApplianceCollector } from "@/collectors/mobilemandu/applianceCollector";
import { neostoreCollector } from "@/collectors/neostore/collector";
import { hukutCollector } from "@/collectors/hukut/collector";
import { brothermartCollector } from "@/collectors/brothermart/collector";
import { itechstoreCollector } from "@/collectors/itechstore/collector";
import { neptronicsCollector } from "@/collectors/neptronics/collector";
import { zolpastoreCollector } from "@/collectors/zolpastore/collector";
import { smartdokoCollector } from "@/collectors/smartdoko/collector";
import { ldsCollector } from "@/collectors/lds/collector";
import { yantranepalCollector } from "@/collectors/yantranepal/collector";
import { gadgethouseCollector } from "@/collectors/gadgethouse/collector";
import { dealayoCollector } from "@/collectors/dealayo/collector";
import { electromanduCollector } from "@/collectors/electromandu/collector";
import { techinnCollector } from "@/collectors/techinn/collector";
import { infotechsnepalCollector } from "@/collectors/infotechsnepal/collector";
import { computerplanetCollector } from "@/collectors/computerplanet/collector";
import { mystoreCollector } from "@/collectors/mystore/collector";
import { maxellCollector } from "@/collectors/maxell/collector";
import { nepomartCollector } from "@/collectors/nepomart/collector";
import { onlineitCollector } from "@/collectors/onlineit/collector";
import { maxinternationalCollector } from "@/collectors/maxinternational/collector";
import { tronixspaceCollector } from "@/collectors/tronixspace/collector";
import { meroepasalCollector } from "@/collectors/meroepasal/collector";
import { bigbyteCollector } from "@/collectors/bigbyte/collector";
import { sewasmartCollector } from "@/collectors/sewasmart/collector";
import { rapidotechCollector } from "@/collectors/rapidotech/collector";
import { exortstoreCollector } from "@/collectors/exortstore/collector";
import type { StoreCollector } from "@/collectors/core/types";

/** Every automated/manual collection entry point (worker, CLI scripts) looks stores up here.
 * More than one entry can point at the same `store.slug` (e.g. evoCollector and
 * evoLaptopsCollector both feed the one "evo-store" row) — this record is keyed by
 * collector/job identity, not by store identity. */
export const COLLECTORS: Record<string, StoreCollector> = {
  [evoCollector.storeId]: evoCollector,
  [evoLaptopsCollector.storeId]: evoLaptopsCollector,
  [ittiCollector.storeId]: ittiCollector,
  [ittiLaptopsCollector.storeId]: ittiLaptopsCollector,
  [ittiGamingCollector.storeId]: ittiGamingCollector,
  [mobilemanduCollector.storeId]: mobilemanduCollector,
  [mobilemanduLaptopsCollector.storeId]: mobilemanduLaptopsCollector,
  [mobilemanduAudioCollector.storeId]: mobilemanduAudioCollector,
  [mobilemanduTvCollector.storeId]: mobilemanduTvCollector,
  [mobilemanduSmartwatchCollector.storeId]: mobilemanduSmartwatchCollector,
  [mobilemanduApplianceCollector.storeId]: mobilemanduApplianceCollector,
  [neostoreCollector.storeId]: neostoreCollector,
  [hukutCollector.storeId]: hukutCollector,
  [brothermartCollector.storeId]: brothermartCollector,
  [itechstoreCollector.storeId]: itechstoreCollector,
  [neptronicsCollector.storeId]: neptronicsCollector,
  [zolpastoreCollector.storeId]: zolpastoreCollector,
  [smartdokoCollector.storeId]: smartdokoCollector,
  [ldsCollector.storeId]: ldsCollector,
  [yantranepalCollector.storeId]: yantranepalCollector,
  [gadgethouseCollector.storeId]: gadgethouseCollector,
  [dealayoCollector.storeId]: dealayoCollector,
  [electromanduCollector.storeId]: electromanduCollector,
  [techinnCollector.storeId]: techinnCollector,
  [infotechsnepalCollector.storeId]: infotechsnepalCollector,
  [computerplanetCollector.storeId]: computerplanetCollector,
  [mystoreCollector.storeId]: mystoreCollector,
  [maxellCollector.storeId]: maxellCollector,
  [nepomartCollector.storeId]: nepomartCollector,
  [onlineitCollector.storeId]: onlineitCollector,
  [maxinternationalCollector.storeId]: maxinternationalCollector,
  [tronixspaceCollector.storeId]: tronixspaceCollector,
  [meroepasalCollector.storeId]: meroepasalCollector,
  [bigbyteCollector.storeId]: bigbyteCollector,
  [sewasmartCollector.storeId]: sewasmartCollector,
  [rapidotechCollector.storeId]: rapidotechCollector,
  [exortstoreCollector.storeId]: exortstoreCollector,
};

export const STORE_IDS = Object.keys(COLLECTORS);

export function getCollector(storeId: string): StoreCollector {
  const collector = COLLECTORS[storeId];
  if (!collector) throw new Error(`unknown storeId "${storeId}" (known stores: ${STORE_IDS.join(", ")})`);
  return collector;
}
