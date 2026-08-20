import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { getQueueStats, getSystemAlerts, listCollectionJobs, summarizeErrors } from "@/lib/admin/observability";
import { listStoreOverviews } from "@/lib/admin/stores";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Observability — PriceNepal Admin" };

const formatDuration = (ms: number | null) => {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
};
const formatAge = (ms: number | null) => {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
};

export default async function AdminObservabilityPage() {
  const [queues, alerts, stores, jobs] = await Promise.all([getQueueStats(), getSystemAlerts(), listStoreOverviews(), listCollectionJobs()]);
  const recentErrors = summarizeErrors(jobs);

  return (
    <div>
      <h1 className="text-3xl font-bold">Observability</h1>
      <p className="mt-2 text-[#66736e]">Is PriceNepal working correctly right now?</p>

      {alerts.length > 0 && (
        <section className="mt-6 rounded-[4px] border border-[#f6c9c2] bg-[#fdecea] p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-[#c0392b]">
            <AlertTriangle size={16} /> System alerts
          </p>
          <ul className="space-y-1.5 text-sm text-[#7a1f14]">
            {alerts.map((alert, index) => (
              <li key={index}>
                {alert.severity === "critical" ? "🔴" : "⚠️"} {alert.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Store health</h2>
        <div className="overflow-hidden rounded-[4px] border border-[#e3e9e5] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#f5f7f6] text-left text-xs font-bold uppercase tracking-wide text-[#66736e]">
              <tr>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Last collection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1ee]">
              {stores.map((store) => (
                <tr key={store.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/stores/${store.id}`} className="font-semibold hover:text-[#0c8b67]">
                      {store.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={store.health === "unknown" ? "Unknown" : `${store.health === "healthy" ? "🟢" : "🔴"} ${store.healthScore ?? "—"}%`}
                      tone={store.health === "healthy" ? "green" : store.health === "failing" ? "red" : "gray"}
                    />
                  </td>
                  <td className="px-4 py-3 text-[#66736e]">{store.lastSuccessfulAt ? new Date(store.lastSuccessfulAt).toLocaleString("en-NP", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Queues</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {queues.map((queue) => (
            <div key={queue.queueName} className="rounded-[4px] border border-[#e3e9e5] bg-white p-5">
              <p className="font-bold">{queue.queueName}</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold text-[#88948e]">Waiting</dt>
                  <dd className="font-bold">{queue.waiting}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-[#88948e]">Active</dt>
                  <dd className="font-bold">{queue.active}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-[#88948e]">Completed</dt>
                  <dd className="font-bold">{queue.completed.toLocaleString("en-IN")}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-[#88948e]">Failed</dt>
                  <dd className="font-bold">{queue.failed.toLocaleString("en-IN")}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-[#88948e]">Oldest waiting job</dt>
                  <dd className="font-bold">{formatAge(queue.oldestWaitingAgeMs)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-[#88948e]">Avg. processing time</dt>
                  <dd className="font-bold">{formatDuration(queue.avgProcessingMs)}</dd>
                </div>
              </dl>
              {queue.recentFailures.length > 0 && (
                <div className="mt-3 border-t border-[#edf1ee] pt-3">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#88948e]">Recent failures</p>
                  <ul className="space-y-1 text-xs text-[#c0392b]">
                    {queue.recentFailures.slice(0, 5).map((failure) => (
                      <li key={failure.jobId} className="truncate">
                        {failure.jobId}: {failure.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Recent errors</h2>
        {recentErrors.length === 0 ? (
          <p className="rounded-[4px] border border-dashed border-[#cbd8d1] bg-white p-6 text-center text-sm text-[#66736e]">No recent collection errors.</p>
        ) : (
          <div className="overflow-hidden rounded-[4px] border border-[#e3e9e5] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#f5f7f6] text-left text-xs font-bold uppercase tracking-wide text-[#66736e]">
                <tr>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1ee]">
                {recentErrors.map((error) => (
                  <tr key={error.jobId}>
                    <td className="px-4 py-3 font-semibold">{error.storeName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#66736e]">{error.jobId}</td>
                    <td className="px-4 py-3">{formatDuration(error.durationMs)}</td>
                    <td className="px-4 py-3 text-[#66736e]">{error.at ? new Date(error.at).toLocaleString("en-NP", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td className="px-4 py-3 text-[#c0392b]">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
