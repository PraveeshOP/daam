import type { Metadata } from "next";
import { listCollectionJobs } from "@/lib/admin/collections";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Pagination } from "@/components/admin/Pagination";

export const metadata: Metadata = { title: "Collections — PriceNepal Admin" };

const PAGE_SIZE = 25;
const formatDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-NP", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "—");
const formatDuration = (ms: number | null) => {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
};

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function AdminCollectionsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  // Retention is bounded by the queue's own removeOnComplete/removeOnFail options (§7/§25 — not
  // a second collection-history table), so pagination here just slices the already-fetched,
  // already-sorted list rather than issuing a second query.
  const allJobs = await listCollectionJobs();
  const total = allJobs.length;
  const jobs = allJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <h1 className="text-3xl font-bold">Collections</h1>
      <p className="mt-2 text-[#66736e]">Every price-collection job the BullMQ queue currently retains, newest first.</p>

      <div className="mt-6 overflow-hidden rounded-[4px] border border-[#e3e9e5] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f7f6] text-left text-xs font-bold uppercase tracking-wide text-[#66736e]">
            <tr>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Discovered</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Price changes</th>
              <th className="px-4 py-3">Errors</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1ee]">
            {jobs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[#66736e]">
                  No collections have run yet.
                </td>
              </tr>
            )}
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-4 py-3 font-semibold">{job.storeName}</td>
                <td className="px-4 py-3">{formatDateTime(job.startedAt)}</td>
                <td className="px-4 py-3">{formatDuration(job.durationMs)}</td>
                <td className="px-4 py-3">{job.discovered}</td>
                <td className="px-4 py-3">{job.updatedOffers}</td>
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

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/collections" />
    </div>
  );
}
