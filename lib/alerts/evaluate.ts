import type { SupabaseServiceClient } from "@/lib/supabase/service";
import { getNotificationsQueue } from "@/lib/queue/notifications";
import { log, logError } from "@/lib/logger";

/** Same "lowest of in-stock offers, else lowest of all offers" rule the frontend uses
 * (lib/data.ts's enrich()) — kept as a small local calculation rather than importing that
 * module, which is wired to the anon client and the local seed-data fallback. */
function computeLowestPrice(offers: { price: number | string; availability: string }[]): number | null {
  if (!offers.length) return null;
  const inStock = offers.filter((offer) => offer.availability === "in_stock");
  const pool = inStock.length ? inStock : offers;
  return Math.min(...pool.map((offer) => Number(offer.price)));
}

const safeJobIdPart = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "");

/**
 * The section-13 hook: called right after a genuine price change is recorded for a product
 * (collectors/core/importer.ts). Recomputes the product's current lowest price across every
 * store, finds alerts that are now met, and — using an atomic claim so a second call for the
 * same product (another store's offer changing moments later, or a concurrent worker job)
 * never double-claims — enqueues exactly one notification job per newly-triggered alert.
 *
 * Never throws: a Redis/DB hiccup here must not fail the price collection job (see importer.ts
 * call site and phase-5 spec section 19). Errors are logged and simply mean the alert gets
 * picked up on the next price change instead.
 */
export async function evaluateProductPriceAlerts(client: SupabaseServiceClient, productId: string): Promise<{ triggeredCount: number }> {
  const { data: offers, error: offersError } = await client.from("offers").select("price, availability").eq("product_id", productId);
  if (offersError) {
    logError("alerts", `could not read offers for product ${productId}: ${offersError.message}`);
    return { triggeredCount: 0 };
  }
  const lowestPrice = computeLowestPrice(offers || []);
  if (lowestPrice === null) return { triggeredCount: 0 };

  const { data: candidates, error: candidatesError } = await client
    .from("price_alerts")
    .select("id")
    .eq("product_id", productId)
    .eq("is_active", true)
    .is("triggered_at", null)
    .gte("target_price", lowestPrice);
  if (candidatesError) {
    logError("alerts", `could not read candidate alerts for product ${productId}: ${candidatesError.message}`);
    return { triggeredCount: 0 };
  }
  if (!candidates?.length) return { triggeredCount: 0 };

  let triggeredCount = 0;
  const queue = getNotificationsQueue();
  for (const candidate of candidates) {
    const triggeredAt = new Date().toISOString();
    // Atomic claim: only the caller that actually flips is_active=true/triggered_at=null to a
    // set value gets a row back, so two near-simultaneous evaluations of the same alert can
    // never both enqueue a notification (prevents the duplicate-email case in section 15).
    const { data: claimed, error: claimError } = await client
      .from("price_alerts")
      .update({ triggered_at: triggeredAt })
      .eq("id", candidate.id)
      .eq("is_active", true)
      .is("triggered_at", null)
      .select("id")
      .maybeSingle();
    if (claimError) {
      logError("alerts", `could not claim alert ${candidate.id}: ${claimError.message}`);
      continue;
    }
    if (!claimed) continue; // another evaluation already claimed it

    try {
      await queue.add(
        "notify",
        { alertId: claimed.id, triggeredPrice: lowestPrice },
        { jobId: `alert-${safeJobIdPart(claimed.id)}-${safeJobIdPart(triggeredAt)}` },
      );
      triggeredCount += 1;
      log("alerts", `alert ${claimed.id} triggered at ${lowestPrice}, notification queued`);
    } catch (enqueueError) {
      // The claim already happened but no notification job exists to ever un-stick it, so
      // release the claim (instead of leaving triggered_at permanently set with nothing to act
      // on it) — the next price change re-evaluates this alert from scratch. Never crashes the
      // collection job (section 19): Redis being briefly unreachable just means "try again
      // later", not "corrupt the alert".
      logError("alerts", `alert ${claimed.id} claimed but failed to queue notification, releasing claim: ${enqueueError instanceof Error ? enqueueError.message : enqueueError}`);
      try {
        await client.from("price_alerts").update({ triggered_at: null }).eq("id", claimed.id);
      } catch {
        // Best-effort release; a stuck claim self-heals once triggered_at is manually cleared.
      }
    }
  }
  return { triggeredCount };
}
