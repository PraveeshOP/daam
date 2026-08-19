"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, Menu, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function Header() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const submit = (event: React.FormEvent) => { event.preventDefault(); router.push(`/search?q=${encodeURIComponent(query)}`); setOpen(false); };
  return <header className="sticky top-0 z-40 border-b border-[#e3e9e5] bg-[#fbfcfa]/95 backdrop-blur">
    <div className="container flex h-[72px] items-center gap-5">
      <Link href="/" className="shrink-0 text-[25px] font-bold tracking-[-0.08em] text-[#17221f]">daam<span className="text-[#ef745f]">.</span></Link>
      <form onSubmit={submit} className="relative hidden max-w-[480px] flex-1 md:block"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#66736e]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search phones, laptops, TVs and more..." className="h-11 w-full rounded-full border border-[#d6dfda] bg-white pl-11 pr-5 text-sm outline-none transition focus:border-[#0c8b67] focus:ring-4 focus:ring-[#d9f5ec]" /></form>
      <nav className="ml-auto hidden items-center gap-6 text-sm font-semibold text-[#52605a] lg:flex"><Link href="/categories" className="transition hover:text-[#0c8b67]">Categories</Link><Link href="/search?q=deals" className="transition hover:text-[#0c8b67]">Deals</Link><Link href="/search?q=price%20drop" className="transition hover:text-[#0c8b67]">Price drops</Link></nav>
      <Link href="/favorites" aria-label="Favorites" className="hidden rounded-full p-2 text-[#52605a] transition hover:bg-[#edf5f1] lg:block"><Heart size={20} /></Link>
      <button aria-label="Toggle menu" onClick={() => setOpen(!open)} className="ml-auto rounded-full p-2 text-[#17221f] hover:bg-[#edf5f1] md:hidden">{open ? <X size={22} /> : <Menu size={22} />}</button>
    </div>
    {open && <div className="border-t border-[#e3e9e5] bg-white p-4 md:hidden"><form onSubmit={submit} className="relative mb-4"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#66736e]" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products..." className="h-12 w-full rounded-full border border-[#d6dfda] pl-11 pr-4 text-sm outline-none focus:border-[#0c8b67]" /></form><nav className="grid gap-1 text-sm font-semibold"><Link onClick={() => setOpen(false)} href="/categories" className="rounded-lg px-3 py-3 hover:bg-[#f2f7f4]">Categories</Link><Link onClick={() => setOpen(false)} href="/search?q=deals" className="rounded-lg px-3 py-3 hover:bg-[#f2f7f4]">Deals</Link><Link onClick={() => setOpen(false)} href="/search?q=price%20drop" className="rounded-lg px-3 py-3 hover:bg-[#f2f7f4]">Price drops</Link></nav></div>}
  </header>;
}
