import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Heart, LogOut, User } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { getFavoriteProductIds } from "@/lib/favorites";
import { getUserAlerts } from "@/lib/alerts/queries";
import { alertStatus } from "@/lib/alerts/status";
import { logoutAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Your account — daam" };

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="container flex min-h-[60vh] items-center justify-center py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#d9f5ec] text-[#0c8b67]">
            <User size={28} />
          </div>
          <h1 className="mt-6 text-3xl font-bold">Log in to view your account</h1>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className="inline-flex rounded-[3px] bg-[#17221f] px-5 py-3 text-sm font-bold text-white hover:bg-[#0c8b67]">
              Log in
            </Link>
            <Link href="/signup" className="inline-flex rounded-[3px] border border-[#d6dfda] px-5 py-3 text-sm font-bold hover:border-[#0c8b67] hover:text-[#0c8b67]">
              Create account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const [favoriteIds, alerts] = await Promise.all([getFavoriteProductIds(user.id), getUserAlerts(user.id)]);
  const activeAlerts = alerts.filter((alert) => alertStatus({ is_active: alert.isActive, triggered_at: alert.triggeredAt }) === "active");
  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-NP", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <main className="container py-10 sm:py-14">
      <h1 className="text-4xl font-bold sm:text-5xl">Your account</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[4px] border border-[#e3e9e5] bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#88948e]">Email</p>
          <p className="mt-1 text-lg font-bold">{user.email}</p>
          {createdAt && <p className="mt-3 text-sm text-[#66736e]">Member since {createdAt}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/favorites" className="flex flex-col justify-between rounded-[4px] border border-[#e3e9e5] bg-white p-6 transition hover:border-[#a9cdbf]">
            <Heart className="text-[#0c8b67]" />
            <div>
              <p className="mt-3 text-2xl font-bold">{favoriteIds.size}</p>
              <p className="text-sm text-[#66736e]">Favorites</p>
            </div>
          </Link>
          <Link href="/alerts" className="flex flex-col justify-between rounded-[4px] border border-[#e3e9e5] bg-white p-6 transition hover:border-[#a9cdbf]">
            <Bell className="text-[#0c8b67]" />
            <div>
              <p className="mt-3 text-2xl font-bold">{activeAlerts.length}</p>
              <p className="text-sm text-[#66736e]">Active alerts</p>
            </div>
          </Link>
        </div>
      </div>

      <form action={logoutAction} className="mt-8">
        <button
          type="submit"
          className="flex items-center gap-2 rounded-[3px] border border-[#d6dfda] px-5 py-3 text-sm font-bold text-[#17221f] transition hover:border-[#ef745f] hover:text-[#ef745f]"
        >
          <LogOut size={16} /> Log out
        </button>
      </form>
    </main>
  );
}
