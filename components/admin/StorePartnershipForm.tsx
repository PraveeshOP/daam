"use client";

import { useActionState } from "react";
import { updateStorePartnershipAction, type PartnershipActionState } from "@/app/admin/actions/stores";

const inputClass = "w-full rounded-[3px] border border-[#d6dfda] bg-white px-3 py-2 text-sm outline-none focus:border-[#0c8b67]";
const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-[#66736e]";

export function StorePartnershipForm({
  storeId,
  initial,
}: {
  storeId: string;
  initial: { partnershipStatus: string; affiliateEnabled: boolean; affiliateNetwork: string | null; affiliateTrackingId: string | null };
}) {
  const [state, formAction] = useActionState<PartnershipActionState, FormData>(updateStorePartnershipAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="storeId" value={storeId} />
      {state?.error && <p role="alert" className="rounded-[3px] bg-[#fdecea] px-3 py-2.5 text-sm font-semibold text-[#c0392b]">{state.error}</p>}
      {state?.success && <p role="status" className="rounded-[3px] bg-[#f0fbf7] px-3 py-2.5 text-sm font-semibold text-[#0c8b67]">{state.success}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="partnershipStatus">Partnership status</label>
          <select id="partnershipStatus" name="partnershipStatus" defaultValue={initial.partnershipStatus} className={inputClass}>
            <option value="none">None</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-[#17221f]">
            <input type="checkbox" name="affiliateEnabled" value="true" defaultChecked={initial.affiliateEnabled} className="h-4 w-4" />
            Affiliate links enabled
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="affiliateNetwork">Affiliate network <span className="font-normal text-[#a0aaa5]">(optional)</span></label>
          <input id="affiliateNetwork" name="affiliateNetwork" defaultValue={initial.affiliateNetwork || ""} placeholder="e.g. Impact, direct" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="affiliateTrackingId">Affiliate tracking ID <span className="font-normal text-[#a0aaa5]">(optional)</span></label>
          <input id="affiliateTrackingId" name="affiliateTrackingId" defaultValue={initial.affiliateTrackingId || ""} className={inputClass} />
        </div>
      </div>

      <p className="text-xs text-[#88948e]">
        Links only ever use an affiliate URL when this store is both enabled here AND partnership status is &quot;Active&quot; AND that specific offer has a valid affiliate URL set — otherwise every click falls back to the store&apos;s regular product URL. This never changes which store is shown as the cheapest.
      </p>

      <button type="submit" className="rounded-[3px] bg-[#17221f] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0c8b67]">
        Save partnership settings
      </button>
    </form>
  );
}
