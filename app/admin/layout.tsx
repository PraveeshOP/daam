import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getAdminSession } from "@/lib/admin/auth";
import { AdminSidebar, ADMIN_NAV } from "@/components/admin/AdminSidebar";

export const metadata: Metadata = { title: "PriceNepal Admin" };

/**
 * The one enforcement point every /admin/* page renders through — see lib/admin/auth.ts for why
 * this is not the *only* enforcement point (Server Actions re-check independently).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (session.status === "unauthenticated") {
    return (
      <main className="container flex min-h-[60vh] items-center justify-center py-16">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold">Admin login required</h1>
          <p className="mt-3 leading-7 text-[#66736e]">Log in with an administrator account to continue.</p>
          <Link href="/login" className="mt-7 inline-flex rounded-[3px] bg-[#17221f] px-5 py-3 text-sm font-bold text-white hover:bg-[#0c8b67]">
            Log in
          </Link>
        </div>
      </main>
    );
  }

  if (session.status === "forbidden") {
    return (
      <main className="container flex min-h-[60vh] items-center justify-center py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fdecea] text-[#c0392b]">
            <ShieldAlert size={28} />
          </div>
          <h1 className="mt-6 text-3xl font-bold">Access denied</h1>
          <p className="mt-3 leading-7 text-[#66736e]">
            {session.email} does not have administrator access. If you believe this is a mistake, contact an existing administrator.
          </p>
          <Link href="/" className="mt-7 inline-flex rounded-[3px] border border-[#d6dfda] px-5 py-3 text-sm font-bold hover:border-[#0c8b67] hover:text-[#0c8b67]">
            Back to PriceNepal
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7f6] lg:flex">
      <aside className="hidden w-[240px] shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 w-[240px]">
          <AdminSidebar />
        </div>
      </aside>
      <div className="border-b border-[#e3e9e5] bg-[#17221f] px-4 py-3 lg:hidden">
        <p className="mb-2 text-sm font-bold text-white">
          PriceNepal <span className="text-[#ef745f]">Admin</span>
        </p>
        <nav className="flex gap-4 overflow-x-auto text-sm font-semibold text-[#cfd8d3]">
          {ADMIN_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="shrink-0 whitespace-nowrap hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
