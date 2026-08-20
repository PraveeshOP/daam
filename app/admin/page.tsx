import Link from "next/link";
import type { Metadata } from "next";
import { Package, Store, Tags, Users, Bell, ArrowRight } from "lucide-react";
import { getDashboardStats, getRecentPriceChanges } from "@/lib/admin/stats";
import { getRecentActivity } from "@/lib/admin/activity";
import { getDataQualityIssues } from "@/lib/admin/dataQuality";
import { listCollectionJobs } from "@/lib/admin/collections";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Dashboard — PriceNepal Admin" };

const npr = (value: number) => `NPR ${Math.round(value).toLocaleString("en-IN")}`;
const timeAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const METRICS = (stats: Awaited<ReturnType<typeof getDashboardStats>>) => [
  { label: "Products", value: stats.products, icon: Package },
  { label: "Stores", value: stats.stores, icon: Store },
  { label: "Active Offers", value: stats.activeOffers, icon: Tags },
  { label: "Users", value: stats.users, icon: Users },
  { label: "Active Price Alerts", value: stats.activeAlerts, icon: Bell },
];

export default async function AdminDashboardPage() {
  const [stats, priceChanges, activity, issues, jobs] = await Promise.all([
    getDashboardStats(),
    getRecentPriceChanges(6),
    getRecentActivity(8),
    getDataQualityIssues(),
    listCollectionJobs(),
  ]);

  const recentJobs = jobs.slice(0, 5);
  const totalIssues = issues.reduce((sum, issue) => sum + issue.count, 0);

  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-[#66736e]">System health at a glance.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {METRICS(stats).map((metric) => (
          <div key={metric.label} className="rounded-[4px] border border-[#e3e9e5] bg-white p-4">
            <metric.icon size={18} className="text-[#0c8b67]" />
            <p className="mt-3 text-2xl font-bold">{metric.value.toLocaleString("en-IN")}</p>
            <p className="text-xs font-semibold text-[#66736e]">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[4px] border border-[#e3e9e5] bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent collections</h2>
            <Link href="/admin/collections" className="flex items-center gap-1 text-sm font-bold text-[#0c8b67] hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-[#66736e]">No collections have run yet.</p>
          ) : (
            <ul className="divide-y divide-[#edf1ee]">
              {recentJobs.map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p className="font-semibold">{job.storeName}</p>
                    <p className="text-xs text-[#88948e]">{job.startedAt ? timeAgo(job.startedAt) : "—"}</p>
                  </div>
                  <StatusBadge
                    label={job.status === "completed" ? "Success" : job.status === "failed" ? "Failed" : job.status === "skipped" ? "Skipped" : job.status}
                    tone={job.status === "completed" ? "green" : job.status === "failed" ? "red" : "gray"}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[4px] border border-[#e3e9e5] bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Data quality issues</h2>
            <Link href="/admin/data-quality" className="flex items-center gap-1 text-sm font-bold text-[#0c8b67] hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {totalIssues === 0 ? (
            <p className="text-sm text-[#66736e]">No data quality issues detected.</p>
          ) : (
            <ul className="space-y-2">
              {issues
                .filter((issue) => issue.count > 0)
                .slice(0, 5)
                .map((issue) => (
                  <li key={issue.key}>
                    <Link href={issue.href} className="flex items-center justify-between rounded-[3px] px-2 py-1.5 text-sm hover:bg-[#f7faf8]">
                      <span>⚠️ {issue.label}</span>
                      <span className="font-bold">{issue.count.toLocaleString("en-IN")}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section className="rounded-[4px] border border-[#e3e9e5] bg-white p-5">
          <h2 className="mb-3 text-lg font-bold">Recent price changes</h2>
          {priceChanges.length === 0 ? (
            <p className="text-sm text-[#66736e]">No price changes recorded yet.</p>
          ) : (
            <ul className="divide-y divide-[#edf1ee]">
              {priceChanges.map((change) => (
                <li key={change.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/product/${change.productSlug}`} className="min-w-0 flex-1 truncate hover:text-[#0c8b67]">
                    {change.productName}
                    {change.storeName && <span className="text-[#88948e]"> · {change.storeName}</span>}
                  </Link>
                  <span className="shrink-0 font-bold">{npr(change.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[4px] border border-[#e3e9e5] bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent activity</h2>
            <Link href="/admin/audit-log" className="flex items-center gap-1 text-sm font-bold text-[#0c8b67] hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-[#66736e]">No recent activity.</p>
          ) : (
            <ul className="divide-y divide-[#edf1ee]">
              {activity.map((item) => (
                <li key={item.id} className="py-2.5 text-sm">
                  <p>{item.message}</p>
                  <p className="text-xs text-[#88948e]">{timeAgo(item.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
