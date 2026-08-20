import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { getUserAlerts } from "@/lib/alerts/queries";
import { alertStatus } from "@/lib/alerts/status";
import { deleteAlertAction } from "@/app/actions/alerts";
import { SafeImage } from "@/components/SafeImage";

export const metadata: Metadata = { title: "Your price alerts — daam" };

const npr = (value: number) => `NPR ${Math.round(value).toLocaleString("en-IN")}`;

const badge = {
  active: { label: "🟢 Active", className: "bg-[#f0fbf7] text-[#0c8b67]" },
  triggered: { label: "✓ Triggered", className: "bg-[#d9f5ec] text-[#0c8b67]" },
  disabled: { label: "Disabled", className: "bg-[#f2f5f2] text-[#66736e]" },
};

export default async function AlertsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="container flex min-h-[60vh] items-center justify-center py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#d9f5ec] text-[#0c8b67]">
            <Bell size={28} />
          </div>
          <h1 className="mt-6 text-3xl font-bold">Never miss a price drop</h1>
          <p className="mt-3 leading-7 text-[#66736e]">Log in to set target prices and get an email the moment they&apos;re reached.</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="inline-flex rounded-[3px] bg-[#17221f] px-5 py-3 text-sm font-bold text-white hover:bg-[#0c8b67]">
              Create account
            </Link>
            <Link href="/login" className="inline-flex rounded-[3px] border border-[#d6dfda] px-5 py-3 text-sm font-bold hover:border-[#0c8b67] hover:text-[#0c8b67]">
              Log in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const alerts = await getUserAlerts(user.id);

  return (
    <main className="container py-10 sm:py-14">
      <h1 className="text-4xl font-bold sm:text-5xl">My Price Alerts</h1>
      <p className="mt-3 text-[#66736e]">We&apos;ll email you the moment a product reaches your target price.</p>

      {alerts.length === 0 ? (
        <div className="mt-10 rounded-[4px] border border-dashed border-[#cbd8d1] bg-white p-12 text-center">
          <h2 className="text-xl font-bold">You don&apos;t have any price alerts yet.</h2>
          <p className="mt-2 text-sm text-[#66736e]">Open a product and set a target price to get started.</p>
          <Link href="/search" className="mt-6 inline-flex rounded-[3px] bg-[#17221f] px-5 py-3 text-sm font-bold text-white hover:bg-[#0c8b67]">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {alerts.map((alert) => {
            const status = alertStatus({ is_active: alert.isActive, triggered_at: alert.triggeredAt });
            return (
              <div key={alert.id} className="flex flex-col gap-4 rounded-[4px] border border-[#e3e9e5] bg-white p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
                <Link href={`/product/${alert.productSlug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[4px] bg-[#f2f5f2] sm:h-24 sm:w-24">
                  <SafeImage src={alert.productImage} alt={alert.productName} fill sizes="96px" className="object-cover" />
                </Link>
                <div className="flex-1">
                  <Link href={`/product/${alert.productSlug}`} className="font-bold hover:text-[#0c8b67]">
                    {alert.productName}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#66736e]">
                    <span>
                      Current price: <span className="font-semibold text-[#17221f]">{npr(alert.currentLowestPrice)}</span>
                    </span>
                    <span>
                      Target: <span className="font-semibold text-[#17221f]">{npr(alert.targetPrice)}</span>
                    </span>
                  </div>
                  {status === "triggered" && alert.triggeredAt && (
                    <p className="mt-1 text-xs text-[#66736e]">
                      Triggered {new Date(alert.triggeredAt).toLocaleDateString("en-NP", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                  <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${badge[status].className}`}>{badge[status].label}</span>
                </div>
                <div className="flex items-center gap-3 sm:shrink-0">
                  <Link
                    href={`/product/${alert.productSlug}#price-alert`}
                    className="rounded-[3px] border border-[#d6dfda] px-4 py-2.5 text-sm font-bold transition hover:border-[#0c8b67] hover:text-[#0c8b67]"
                  >
                    Edit
                  </Link>
                  <form action={deleteAlertAction}>
                    <input type="hidden" name="alertId" value={alert.id} />
                    <input type="hidden" name="productId" value={alert.productId} />
                    <button type="submit" className="rounded-[3px] border border-[#d6dfda] px-4 py-2.5 text-sm font-bold text-[#66736e] transition hover:border-[#ef745f] hover:text-[#ef745f]">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
