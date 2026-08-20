import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { listAuditLog } from "@/lib/admin/auditLog";
import { Pagination } from "@/components/admin/Pagination";

export const metadata: Metadata = { title: "Audit Log — PriceNepal Admin" };

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function AdminAuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, total, pageSize } = await listAuditLog(page);

  return (
    <div>
      <Link href="/admin" className="flex items-center gap-2 text-sm font-bold text-[#0c8b67]">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Audit Log</h1>
      <p className="mt-2 text-[#66736e]">Every administrative action, using the actual authenticated admin identity.</p>

      <div className="mt-6 overflow-hidden rounded-[4px] border border-[#e3e9e5] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f7f6] text-left text-xs font-bold uppercase tracking-wide text-[#66736e]">
            <tr>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1ee]">
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[#66736e]">
                  No administrative actions recorded yet.
                </td>
              </tr>
            )}
            {items.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3">{entry.adminEmail}</td>
                <td className="px-4 py-3 font-semibold">{entry.action}</td>
                <td className="px-4 py-3 text-[#66736e]">
                  {entry.entityType}
                  {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ""}
                </td>
                <td className="px-4 py-3 text-[#66736e]">{new Date(entry.createdAt).toLocaleString("en-NP", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/audit-log" />
    </div>
  );
}
