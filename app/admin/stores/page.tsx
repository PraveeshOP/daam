import Link from "next/link";
import type { Metadata } from "next";
import { listStoreOverviews } from "@/lib/admin/stores";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { RunCollectionButton } from "@/components/admin/RunCollectionButton";

export const metadata: Metadata = { title: "Stores — PriceNepal Admin" };

const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-NP", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "Never");

export default async function AdminStoresPage() {
  const stores = await listStoreOverviews();

  return (
    <div>
      <h1 className="text-3xl font-bold">Stores</h1>
      <p className="mt-2 text-[#66736e]">{stores.length} stores connected.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {stores.map((store) => (
          <div key={store.id} className="rounded-[4px] border border-[#e3e9e5] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={`/admin/stores/${store.id}`} className="text-lg font-bold hover:text-[#0c8b67]">
                  {store.name}
                </Link>
                <p className="text-xs text-[#88948e]">{store.websiteUrl}</p>
              </div>
              <StatusBadge
                label={
                  store.health === "healthy"
                    ? `✅ Healthy${store.healthScore !== null ? ` ${store.healthScore}%` : ""}`
                    : store.health === "failing"
                      ? `⚠️ Failing${store.healthScore !== null ? ` ${store.healthScore}%` : ""}`
                      : "Unknown"
                }
                tone={store.health === "healthy" ? "green" : store.health === "failing" ? "red" : "gray"}
              />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold text-[#88948e]">Products</dt>
                <dd className="font-bold">{store.productCount.toLocaleString("en-IN")}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#88948e]">Active offers</dt>
                <dd className="font-bold">{store.activeOfferCount.toLocaleString("en-IN")}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#88948e]">Last collection</dt>
                <dd className="font-bold">{timeOf(store.lastSuccessfulAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#88948e]">Errors (last run)</dt>
                <dd className="font-bold">{store.errorCount}</dd>
              </div>
            </dl>

            {store.health === "failing" && store.lastError && (
              <p className="mt-3 rounded-[3px] bg-[#fdecea] px-3 py-2 text-xs font-semibold text-[#c0392b]">Error: {store.lastError}</p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <Link href={`/admin/stores/${store.id}`} className="text-sm font-bold text-[#0c8b67] hover:underline">
                View details
              </Link>
              <RunCollectionButton storeId={store.slug} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
