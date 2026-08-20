"use client";

import { useActionState } from "react";
import { setOfferAffiliateUrlAction } from "@/app/admin/actions/offers";

/**
 * §6: the inline editor for an offer's affiliate URL. `ConfirmAction` (components/admin/
 * ConfirmAction.tsx) is built for dangerous one-click confirmations, not free-text entry, so
 * this is its own small client component rather than stretching that one to fit.
 */
export function AffiliateUrlEditor({ offerId, initialValue }: { offerId: string; initialValue: string | null }) {
  const [state, formAction] = useActionState(setOfferAffiliateUrlAction, undefined);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="offerId" value={offerId} />
      <input
        name="affiliateUrl"
        defaultValue={initialValue || ""}
        placeholder="No affiliate URL"
        className="w-40 rounded-[3px] border border-[#d6dfda] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#0c8b67] sm:w-52"
      />
      <button type="submit" className="shrink-0 rounded-[3px] border border-[#d6dfda] px-2.5 py-1.5 text-xs font-bold hover:border-[#0c8b67] hover:text-[#0c8b67]">
        Save
      </button>
      {state?.error && <span className="text-xs font-semibold text-[#c0392b]">{state.error}</span>}
    </form>
  );
}
