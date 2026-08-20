import Link from "next/link";
import type { Metadata } from "next";
import { listMatchCandidates } from "@/lib/admin/matches";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { Pagination } from "@/components/admin/Pagination";
import { acceptMatchAction, rejectMatchAction } from "@/app/admin/actions/matches";

export const metadata: Metadata = { title: "Product Matches — PriceNepal Admin" };

const TABS = [
  { value: "pending", label: "Pending review" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Kept separate" },
] as const;

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function AdminMatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = (TABS.some((tab) => tab.value === params.status) ? params.status : "pending") as "pending" | "accepted" | "rejected";
  const page = Math.max(1, Number(params.page) || 1);

  const { items, total, pageSize } = await listMatchCandidates(status, page);

  return (
    <div>
      <h1 className="text-3xl font-bold">Product Matches</h1>
      <p className="mt-2 text-[#66736e]">Review products the automated matcher wasn&apos;t confident enough to merge on its own.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/matches?status=${tab.value}`}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${status === tab.value ? "bg-[#17221f] text-white" : "border border-[#d6dfda] text-[#66736e] hover:border-[#0c8b67] hover:text-[#0c8b67]"}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-[4px] border border-dashed border-[#cbd8d1] bg-white p-10 text-center text-[#66736e]">
          No {status === "pending" ? "matches waiting for review" : status} matches.
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {items.map((match) => (
            <div key={match.id} className="rounded-[4px] border border-[#e3e9e5] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#88948e]">Potential match {match.storeName ? `· from ${match.storeName}` : ""}</p>
                <StatusBadge label={`${match.confidence.toFixed(0)}% confidence`} tone={match.confidence >= 70 ? "amber" : "gray"} />
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-[#88948e]">New store product</p>
                  <Link href={`/admin/products/${match.newProduct.id}`} className="font-bold hover:text-[#0c8b67]">
                    {match.newProduct.name}
                  </Link>
                  <p className="text-xs text-[#88948e]">{match.newProduct.brand}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#88948e]">Existing product</p>
                  <Link href={`/admin/products/${match.candidateProduct.id}`} className="font-bold hover:text-[#0c8b67]">
                    {match.candidateProduct.name}
                  </Link>
                  <p className="text-xs text-[#88948e]">{match.candidateProduct.brand}</p>
                </div>
              </div>

              {match.reasons.length > 0 && <p className="mt-3 text-xs text-[#88948e]">Matched on: {match.reasons.join(", ")}</p>}

              {status === "pending" ? (
                <div className="mt-4 flex gap-3">
                  <ConfirmAction
                    action={acceptMatchAction}
                    hiddenFields={{ candidateId: match.id }}
                    triggerLabel="Accept match"
                    triggerClassName="rounded-[3px] bg-[#17221f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0c8b67]"
                    title="Accept this match?"
                    description="The new store offer (and its price history) will move onto the existing product, and the duplicate product will be disabled."
                    confirmLabel="Accept match"
                    danger={false}
                  />
                  <ConfirmAction
                    action={rejectMatchAction}
                    hiddenFields={{ candidateId: match.id }}
                    triggerLabel="Keep separate"
                    triggerClassName="rounded-[3px] border border-[#d6dfda] px-4 py-2.5 text-sm font-bold transition hover:border-[#17221f]"
                    title="Keep these as separate products?"
                    description="Both products will remain as-is. You can revisit this later from the product page if needed."
                    confirmLabel="Keep separate"
                    danger={false}
                  />
                </div>
              ) : (
                <p className="mt-4 text-xs text-[#88948e]">Decided {match.decidedAt ? new Date(match.decidedAt).toLocaleDateString("en-NP", { day: "numeric", month: "short", year: "numeric" }) : ""}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/matches" searchParams={{ status }} />
    </div>
  );
}
