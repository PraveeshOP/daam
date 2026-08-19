"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createOrUpdateAlertAction, deleteAlertAction, type AlertActionState } from "@/app/actions/alerts";
import { SubmitButton } from "@/components/auth/SubmitButton";
import type { AlertStatus } from "@/lib/alerts/status";

const npr = (value: number) => `NPR ${Math.round(value).toLocaleString("en-IN")}`;

const statusBadge: Record<AlertStatus, { label: string; className: string }> = {
  active: { label: "🟢 Alert active", className: "bg-[#f0fbf7] text-[#0c8b67]" },
  triggered: { label: "✓ Alert triggered", className: "bg-[#d9f5ec] text-[#0c8b67]" },
  disabled: { label: "Alert disabled", className: "bg-[#f2f5f2] text-[#66736e]" },
};

type Props = {
  productId: string;
  currentLowestPrice: number;
  isAuthenticated: boolean;
  existingAlert: { id: string; targetPrice: number; triggeredAt: string | null; status: AlertStatus } | null;
};

export function PriceAlertForm({ productId, currentLowestPrice, isAuthenticated, existingAlert }: Props) {
  const [state, formAction] = useActionState<AlertActionState, FormData>(createOrUpdateAlertAction, undefined);

  if (!isAuthenticated) {
    return (
      <div className="rounded-[4px] border border-[#e3e9e5] bg-white p-5 sm:p-7">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#88948e]">
          <Bell size={14} /> Price alert
        </p>
        <h2 className="mt-1 text-2xl font-bold">Get notified when the price drops</h2>
        <p className="mt-3 text-sm leading-6 text-[#66736e]">
          <Link href="/signup" className="font-bold text-[#0c8b67] hover:underline">
            Create an account
          </Link>{" "}
          to set a target price and we will email you when it&apos;s reached.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[4px] border border-[#e3e9e5] bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#88948e]">
          <Bell size={14} /> Price alert
        </p>
        {existingAlert && (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge[existingAlert.status].className}`}>
            {statusBadge[existingAlert.status].label}
          </span>
        )}
      </div>
      <h2 className="mt-1 text-2xl font-bold">Notify me when price reaches</h2>
      <p className="mt-2 text-sm text-[#66736e]">
        Current lowest price: <span className="font-bold text-[#17221f]">{npr(currentLowestPrice)}</span>
      </p>

      {existingAlert?.status === "triggered" && (
        <p className="mt-3 rounded-[3px] bg-[#f0fbf7] px-3 py-2.5 text-sm font-semibold text-[#0c8b67]">
          Price reached {npr(existingAlert.targetPrice)} — we emailed you. Set a new target below to watch it again.
        </p>
      )}

      <form action={formAction} className="mt-4">
        <input type="hidden" name="productId" value={productId} />
        {state?.error && <p role="alert" className="mb-3 rounded-[3px] bg-[#fdecea] px-3 py-2.5 text-sm font-semibold text-[#c0392b]">{state.error}</p>}
        {state?.success && <p role="status" className="mb-3 rounded-[3px] bg-[#f0fbf7] px-3 py-2.5 text-sm font-semibold text-[#0c8b67]">{state.success}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#66736e]">NPR</span>
            <input
              name="targetPrice"
              type="number"
              inputMode="numeric"
              min={1}
              step="1"
              required
              defaultValue={existingAlert && existingAlert.status !== "triggered" ? existingAlert.targetPrice : undefined}
              placeholder={String(Math.max(1, Math.round(currentLowestPrice * 0.95)))}
              className="w-full rounded-[3px] border border-[#d6dfda] bg-white py-2.5 pl-14 pr-4 text-sm font-semibold outline-none transition focus:border-[#0c8b67] focus:ring-4 focus:ring-[#d9f5ec]"
            />
          </div>
          <SubmitButton pendingText="Saving…">{existingAlert ? "Update alert" : "Create alert"}</SubmitButton>
        </div>
      </form>

      {existingAlert && existingAlert.status !== "triggered" && (
        <form action={deleteAlertAction} className="mt-3">
          <input type="hidden" name="alertId" value={existingAlert.id} />
          <button type="submit" className="text-xs font-bold text-[#66736e] hover:text-[#ef745f]">
            Remove alert
          </button>
        </form>
      )}
    </div>
  );
}
