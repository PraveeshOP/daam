import { ExternalLink, Truck, Clock } from "lucide-react";
import type { Offer, Store } from "@/types";
import { getStoreDestination } from "@/lib/stores/destination";
import { rankOffers, bestOffer } from "@/lib/offers/ranking";
import { isStale } from "@/lib/offers/staleness";
const npr = (value: number) => `NPR ${value.toLocaleString("en-IN")}`;
export function OfferTable({
  offers,
  stores,
}: {
  offers: Offer[];
  stores: Store[];
}) {
  const sorted = rankOffers(offers);
  const inStock = sorted.filter((offer) => offer.availability === "in_stock");
  const best = bestOffer(offers)?.price;
  if (!offers.length) {
    return <div className="rounded-[4px] border border-dashed border-[#cbd8d1] bg-white p-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#88948e]">Where to buy</p><h2 className="mt-1 text-2xl font-bold">No offers yet</h2><p className="mt-3 text-sm leading-6 text-[#66736e]">We do not have prices for this product yet. Check back soon.</p></div>;
  }
  // §11/§12: this is purely for the disclosure line below — `sorted` above is already fixed by
  // price alone, so nothing here can (or does) feed back into ranking.
  const hasAffiliateOffer = sorted.some((offer) => {
    const store = stores.find((item) => item.id === offer.storeId);
    if (!store) return false;
    return getStoreDestination(
      { productUrl: offer.productUrl, affiliateUrl: offer.affiliateUrl },
      { affiliateEnabled: store.affiliateEnabled ?? false, partnershipStatus: store.partnershipStatus ?? "none" },
    ).type === "affiliate";
  });
  return (
    <div className="overflow-hidden rounded-[4px] border border-[#e3e9e5] bg-white">
      <div className="border-b border-[#e3e9e5] p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#88948e]">
          Where to buy
        </p>
        <h2 className="mt-1 text-2xl font-bold">
          Available from {offers.length} stores
        </h2>
      </div>
      <div>
        {sorted.map((offer) => {
          const store = stores.find((item) => item.id === offer.storeId);
          const isBest =
            offer.price === best &&
            (offer.availability === "in_stock" || !inStock.length);
          return (
            <div
              key={offer.id}
              className={`grid gap-3 border-b border-[#edf1ee] p-5 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-8 sm:p-6 ${isBest ? "bg-[#f0fbf7]" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#17221f] text-sm font-bold text-white">
                  {store?.logo}
                </span>
                <div>
                  <p className="font-bold">{store?.name}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-[#66736e]">
                    <Truck size={12} /> {store?.delivery}
                  </p>
                </div>
              </div>
              <div className="sm:text-right">
                <p
                  className={`text-lg font-bold ${isBest ? "text-[#0c8b67]" : "text-[#17221f]"}`}
                >
                  {npr(offer.price)}
                </p>
                <span
                  className={`text-xs font-semibold ${offer.availability === "in_stock" ? "text-[#0c8b67]" : "text-[#ef745f]"}`}
                >
                  {isBest && offer.availability === "in_stock"
                    ? "Best price · "
                    : ""}
                  {offer.availability === "in_stock"
                    ? "In stock"
                    : "Out of stock"}
                </span>
                {/* §I1 (phase-9 audit): staleness was previously admin-only (lib/admin/stores.ts's
                    health badges) even though last_checked already flows all the way to the
                    public Offer type — this surfaces the same signal to shoppers directly. */}
                {isStale(offer.lastCheckedAt) && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-[#88948e] sm:justify-end">
                    <Clock size={11} /> Price may be outdated
                  </p>
                )}
              </div>
              {/*
                §9: always through the server-side redirect, never straight to the store or an
                affiliate link — /go/[offerId] resolves the destination and records the click.
                Opening in a new tab means the redirect happens in that new tab, so this page
                never navigates away.
              */}
              <a
                href={`/go/${offer.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-[3px] border border-[#bacac2] px-4 py-2 text-sm font-bold transition hover:border-[#0c8b67] hover:text-[#0c8b67]"
              >
                Visit store <ExternalLink size={14} />
              </a>
            </div>
          );
        })}
      </div>
      {hasAffiliateOffer && (
        <p className="border-t border-[#edf1ee] px-5 py-3 text-xs text-[#88948e] sm:px-7">
          Some links may earn daam a commission at no additional cost to you. This never affects which store is shown as the best price.
        </p>
      )}
    </div>
  );
}
