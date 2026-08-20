import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStoreDestination } from "@/lib/stores/destination";
import { trackEvent } from "@/lib/analytics/track";
import { getTrackingIdentity } from "@/lib/analytics/identity";
import { shouldRecordClick } from "@/lib/stores/clickRateLimit";
import { logError } from "@/lib/logger";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * §9: the single, reliable place an outbound click is recorded and resolved — the UI never
 * links straight to a store or affiliate URL. Only ever takes an *offer id* from the request;
 * the actual destination always comes from the offers/stores rows that id resolves to, never
 * from anything the caller supplies, so this cannot become an open redirect (§10) no matter
 * what's appended to the URL.
 */
export async function GET(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const origin = new URL(request.url).origin;
  const homeFallback = NextResponse.redirect(new URL("/", origin));

  if (!UUID_PATTERN.test(offerId)) return homeFallback;

  const service = createServiceClient();
  const { data: offer, error } = await service
    .from("offers")
    .select("id, product_id, store_id, product_url, affiliate_url, is_disabled, products(slug), stores(affiliate_enabled, partnership_status, tracking_params)")
    .eq("id", offerId)
    .maybeSingle();

  if (error || !offer || offer.is_disabled) return homeFallback;

  const product = offer.products as unknown as { slug: string } | null;
  const productFallback = product ? NextResponse.redirect(new URL(`/product/${product.slug}`, origin)) : homeFallback;

  const store = offer.stores as unknown as { affiliate_enabled: boolean; partnership_status: string; tracking_params: Record<string, string> | null } | null;
  const destination = getStoreDestination(
    { productUrl: offer.product_url, affiliateUrl: offer.affiliate_url },
    { affiliateEnabled: store?.affiliate_enabled ?? false, partnershipStatus: store?.partnership_status ?? "none", trackingParams: store?.tracking_params },
  );

  // Belt-and-suspenders on top of getStoreDestination's own validation — this route is the
  // trust boundary, so re-check the final URL is genuinely http(s) before ever redirecting.
  let target: URL;
  try {
    target = new URL(destination.url);
    if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("non-http(s) scheme");
  } catch {
    logError("stores", `offer ${offerId} resolved to an invalid destination URL, falling back to the product page`);
    return productFallback;
  }

  // Recording is best-effort and never blocks the redirect (§25/§27) — after() runs once the
  // 302 has already been sent to the browser.
  after(async () => {
    const { userId, anonymousId } = await getTrackingIdentity();
    const allowed = await shouldRecordClick(userId ?? anonymousId ?? "anonymous");
    if (!allowed) return;
    await trackEvent({
      eventName: "store_click",
      userId,
      anonymousId,
      productId: offer.product_id,
      storeId: offer.store_id,
      properties: { product_id: offer.product_id, store_id: offer.store_id, offer_id: offer.id, destination_type: destination.type },
    });
  });

  return NextResponse.redirect(target, { status: 302 });
}
