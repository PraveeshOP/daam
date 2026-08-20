import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getStoreOverview } from "@/lib/admin/stores";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { RunCollectionButton } from "@/components/admin/RunCollectionButton";

export const metadata: Metadata = { title: "Store — PriceNepal Admin" };

const formatDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-NP", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "—");
const formatDuration = (ms: number | null) => {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
};

export default async function AdminStoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStoreOverview(id);

  if (!store) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Store not found</h1>
        <Link href="/admin/stores" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#0c8b67]">
          <ArrowLeft size={14} /> Back to stores
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/stores" className="flex items-center gap-2 text-sm font-bold text-[#0c8b67]">
        <ArrowLeft size={14} /> Back to stores
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{store.name}</h1>
            <StatusBadge
              label={store.health === "healthy" ? "✅ Healthy" : store.health === "failing" ? "⚠️ Failing" : "Unknown"}
              tone={store.health === "healthy" ? "green" : store.health === "failing" ? "red" : "gray"}
            />
          </div>
          {store.websiteUrl && (
            <a href={store.websiteUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-[#66736e] hover:text-[#0c8b67]">
              {store.websiteUrl}
            </a>
          )}
        </div>
        <RunCollectionButton storeId={store.slug} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Products", value: store.productCount.toLocaleString("en-IN") },
          { label: "Active offers", value: store.activeOfferCount.toLocaleString("en-IN") },
          { label: "Last successful collection", value: formatDateTime(store.lastSuccessfulAt) },
          { label: "Last collection duration", value: formatDuration(store.lastDurationMs) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[4px] border border-[#e3e9e5] bg-white p-4">
            <p className="text-lg font-bold">{stat.value}</p>
            <p className="text-xs font-semibold text-[#66736e]">{stat.label}</p>
          </div>
        ))}
      </div>

      {store.lastError && (
        <div className="mt-6 rounded-[4px] border border-[#f6c9c2] bg-[#fdecea] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#c0392b]">Last error</p>
          <p className="mt-1 text-sm text-[#7a1f14]">{store.lastError}</p>
        </div>
      )}

      <section className="mt-8 rounded-[4px] border border-[#e3e9e5] bg-white">
        <div className="border-b border-[#e3e9e5] p-5">
          <h2 className="text-lg font-bold">Collection history</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f5f7f6] text-left text-xs font-bold uppercase tracking-wide text-[#66736e]">
              <tr>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Discovered</th>
                <th className="px-4 py-3">Price changes</th>
                <th className="px-4 py-3">Errors</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1ee]">
              {store.recentJobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#66736e]">
                    No collections recorded yet.
                  </td>
                </tr>
              )}
              {store.recentJobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-3">{formatDateTime(job.startedAt)}</td>
                  <td className="px-4 py-3">{formatDuration(job.durationMs)}</td>
                  <td className="px-4 py-3">{job.discovered}</td>
                  <td className="px-4 py-3">{job.priceChanges}</td>
                  <td className="px-4 py-3">{job.errorCount}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={job.status === "completed" ? "SUCCESS" : job.status.toUpperCase()}
                      tone={job.status === "completed" ? "green" : job.status === "failed" ? "red" : "gray"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
