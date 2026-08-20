import Link from "next/link";
import {
  LayoutDashboard,
  BarChart3,
  Package,
  Store,
  Tags,
  GitMerge,
  RefreshCw,
  Activity,
  ShieldAlert,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/stores", label: "Stores", icon: Store },
  { href: "/admin/offers", label: "Offers", icon: Tags },
  { href: "/admin/matches", label: "Product Matches", icon: GitMerge },
  { href: "/admin/collections", label: "Collections", icon: RefreshCw },
  { href: "/admin/observability", label: "Observability", icon: Activity },
  { href: "/admin/data-quality", label: "Data Quality", icon: ShieldAlert },
];

export function AdminSidebar() {
  return (
    <div className="flex h-full flex-col bg-[#17221f] text-[#cfd8d3]">
      <div className="px-5 pt-6 pb-4">
        <p className="text-lg font-bold text-white">
          PriceNepal <span className="text-[#ef745f]">Admin</span>
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-[4px] px-3 py-2.5 text-sm font-semibold transition hover:bg-white/10 hover:text-white"
          >
            <item.icon size={16} /> {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 px-3 py-4">
        <Link href="/" className="flex items-center gap-3 rounded-[4px] px-3 py-2.5 text-sm font-semibold transition hover:bg-white/10 hover:text-white">
          <ArrowLeft size={16} /> Back to PriceNepal
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-[4px] px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-white/10 hover:text-white">
            <LogOut size={16} /> Logout
          </button>
        </form>
      </div>
    </div>
  );
}

export const ADMIN_NAV = NAV;
