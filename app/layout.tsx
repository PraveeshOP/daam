import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = { title: "daam — Compare prices in Nepal", description: "Compare prices from trusted stores across Nepal and shop smarter." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><Header />{children}<footer className="border-t border-[#e3e9e5] bg-white"><div className="container flex flex-col gap-3 py-8 text-sm text-[#66736e] sm:flex-row sm:items-center sm:justify-between"><p><span className="font-bold text-[#17221f]">daam</span> · Compare prices. Shop smarter.</p><p>Built for shoppers in Nepal · NPR prices</p></div></footer></>;
}
