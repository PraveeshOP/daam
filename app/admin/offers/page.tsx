import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { listAdminOffers, type OfferFilter } from "@/lib/admin/offers";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { Pagination } from "@/components/admin/Pagination";
import { AffiliateUrlEditor } from "@/components/admin/AffiliateUrlEditor";
import { setOfferDisabledAction, setOfferAvailabilityAction } from "@/app/admin/actions/offers";

export const metadata: Metadata = { title: "Offers — PriceNepal Admin" };

const npr = (value: number) => `NPR ${Math.round(value).toLocaleString("en-IN")}`;
const FILTERS: { value: OfferFilter; label: string }[] = [
  { value: "all", label: "All offers" },
  { value: "invalid_price", label: "Invalid prices" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "stale", label: "Stale" },
  { value: "duplicate_url", label: "Duplicate URLs" },
  { value: "disabled", label: "Disabled" },
];

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function AdminOffersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filter = (FILTERS.some((item) => item.value === params.filter) ? params.filter : "all") as OfferFilter;
  const page = Math.max(1, Number(params.page) || 1);

  const { items, total, pageSize, capped } = await listAdminOffers(filter, page);

  return (
    <div>
      <h1 className="text-3xl font-bold">Offers</h1>
      <p className="mt-2 text-[#66736e]">{total.toLocaleString("en-IN")} offers{capped ? " (scanned the most recent 2,000)" : ""}.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.value}
            href={`/admin/offers?filter=${item.value}`}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${filter === item.value ? "bg-[#17221f] text-white" : "border border-[#d6dfda] text-[#66736e] hover:border-[#0c8b67] hover:text-[#0c8b67]"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-[4px] border border-[#e3e9e5] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f7f6] text-left text-xs font-bold uppercase tracking-wide text-[#66736e]">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Availability</th>
              <th className="px-4 py-3">Last checked</th>
              <th className="px-4 py-3">Affiliate URL</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1ee]">
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[#66736e]">
                  No offers match this filter.
                </td>
              </tr>
            )}
            {items.map((offer) => (
              <tr key={offer.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/products/${offer.productId}`} className="font-semibold hover:text-[#0c8b67]">
                    {offer.productName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#66736e]">{offer.storeName}</td>
                <td className="px-4 py-3 font-semibold">{offer.price > 0 ? npr(offer.price) : <span className="text-[#c0392b]">Invalid</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge label={offer.availability === "in_stock" ? "In stock" : "Out of stock"} tone={offer.availability === "in_stock" ? "green" : "amber"} />
                    {offer.isDisabled && <StatusBadge label="Disabled" tone="gray" />}
                    {offer.isStale && <StatusBadge label="Stale" tone="amber" />}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#66736e]">{new Date(offer.lastChecked).toLocaleString("en-NP", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <AffiliateUrlEditor offerId={offer.id} initialValue={offer.affiliateUrl} />
                    {offer.affiliateUrlStatus === "invalid" && <StatusBadge label="Malformed" tone="red" />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <a href={offer.productUrl} target="_blank" rel="noreferrer" className="rounded-[3px] border border-[#d6dfda] p-1.5 hover:border-[#0c8b67] hover:text-[#0c8b67]" aria-label="Open store URL">
                      <ExternalLink size={14} />
                    </a>
                    {offer.availability === "in_stock" ? (
                      <ConfirmAction
                        action={setOfferAvailabilityAction}
                        hiddenFields={{ offerId: offer.id, availability: "out_of_stock" }}
                        triggerLabel="Mark unavailable"
                        title="Mark this offer unavailable?"
                        description="This overrides what the collector last saw, until the next check updates it again."
                        confirmLabel="Mark unavailable"
                        danger={false}
                      />
                    ) : (
                      <ConfirmAction
                        action={setOfferAvailabilityAction}
                        hiddenFields={{ offerId: offer.id, availability: "in_stock" }}
                        triggerLabel="Mark in stock"
                        title="Mark this offer in stock?"
                        description="This overrides what the collector last saw, until the next check updates it again."
                        confirmLabel="Mark in stock"
                        danger={false}
                      />
                    )}
                    {offer.isDisabled ? (
                      <ConfirmAction
                        action={setOfferDisabledAction}
                        hiddenFields={{ offerId: offer.id, disabled: "false" }}
                        triggerLabel="Enable"
                        triggerClassName="rounded-[3px] border border-[#d6dfda] px-3 py-1.5 text-sm font-bold transition hover:border-[#0c8b67] hover:text-[#0c8b67]"
                        title="Re-enable this offer?"
                        description="This will make the offer visible for comparison on the public site again."
                        confirmLabel="Enable"
                        danger={false}
                      />
                    ) : (
                      <ConfirmAction
                        action={setOfferDisabledAction}
                        hiddenFields={{ offerId: offer.id, disabled: "true" }}
                        triggerLabel="Disable"
                        title="Disable this offer?"
                        description="This will hide the offer from the public site. Its price history is kept."
                        confirmLabel="Disable offer"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/offers" searchParams={{ filter }} />
    </div>
  );
}
