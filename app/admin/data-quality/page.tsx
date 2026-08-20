import Link from "next/link";
import type { Metadata } from "next";
import { getDataQualityIssues, getDataQualityTrends, recordDataQualitySnapshots } from "@/lib/admin/dataQuality";

export const metadata: Metadata = { title: "Data Quality — PriceNepal Admin" };

const TREND_LABEL: Record<string, string> = { increasing: "↑ Increasing", decreasing: "↓ Decreasing", stable: "→ Stable", new: "New" };
const TREND_CLASS: Record<string, string> = {
  increasing: "text-[#c0392b]",
  decreasing: "text-[#0c8b67]",
  stable: "text-[#66736e]",
  new: "text-[#88948e]",
};

export default async function AdminDataQualityPage() {
  const issues = await getDataQualityIssues();
  const trends = await getDataQualityTrends(issues);
  // Fire-and-forget-ish: recording today's snapshot isn't part of what the admin is here to see,
  // so it shouldn't hold up the render — but there's no request/response boundary issue here
  // (this is the read itself, not a mutation), so a plain await of a cheap, already-throttled
  // write is simplest.
  await recordDataQualitySnapshots(issues);

  const totalIssues = issues.reduce((sum, issue) => sum + issue.count, 0);

  return (
    <div>
      <h1 className="text-3xl font-bold">Data Quality</h1>
      <p className="mt-2 text-[#66736e]">
        {totalIssues === 0 ? "No data quality issues detected." : `${totalIssues.toLocaleString("en-IN")} issues found across ${issues.filter((issue) => issue.count > 0).length} categories.`}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {issues.map((issue) => (
          <Link
            key={issue.key}
            href={issue.href}
            className={`rounded-[4px] border p-5 transition hover:-translate-y-0.5 ${issue.count > 0 ? "border-[#f6c9c2] bg-[#fff9f6]" : "border-[#e3e9e5] bg-white"}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-3xl font-bold">{issue.count.toLocaleString("en-IN")}</p>
              <span className={`text-xs font-bold ${TREND_CLASS[trends[issue.key]]}`}>{TREND_LABEL[trends[issue.key]]}</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-[#66736e]">
              {issue.count > 0 ? "⚠️ " : ""}
              {issue.label}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
