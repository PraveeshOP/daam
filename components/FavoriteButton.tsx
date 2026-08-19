"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/app/actions/favorites";

type Props = {
  productId: string;
  initialFavorited: boolean;
  isAuthenticated: boolean;
  /** "icon" for tight spaces like product cards; "labeled" shows the ♡ Save / ♥ Saved text. */
  variant?: "icon" | "labeled";
  className?: string;
};

export function FavoriteButton({ productId, initialFavorited, isAuthenticated, variant = "labeled", className = "" }: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (!isAuthenticated) {
      setShowPrompt((value) => !value);
      return;
    }
    setError(false);
    const next = !favorited;
    setFavorited(next); // optimistic
    startTransition(async () => {
      const result = await toggleFavorite(productId);
      if (!result.ok) {
        setFavorited(!next); // revert
        setError(true);
        return;
      }
      setFavorited(result.favorited);
    });
  };

  const iconOnly = variant === "icon";
  const base = iconOnly
    ? "flex h-9 w-9 items-center justify-center rounded-full border transition"
    : "flex items-center gap-2 rounded-[3px] border px-4 py-2.5 text-sm font-bold transition";
  const tone = favorited
    ? "border-[#ef745f] bg-[#fdecea] text-[#ef745f]"
    : "border-[#d6dfda] bg-white text-[#66736e] hover:border-[#0c8b67] hover:text-[#0c8b67]";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={favorited}
        aria-label={favorited ? "Remove from favorites" : "Save product"}
        className={`${base} ${tone} disabled:cursor-wait disabled:opacity-70 ${className}`}
      >
        <Heart size={iconOnly ? 17 : 16} fill={favorited ? "#ef745f" : "none"} />
        {!iconOnly && <span>{favorited ? "Saved" : "Save"}</span>}
      </button>
      {showPrompt && (
        <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-[4px] border border-[#e3e9e5] bg-white p-3 text-xs leading-5 text-[#66736e] shadow-[0_12px_30px_rgba(23,34,31,0.12)]">
          <p className="font-semibold text-[#17221f]">Create an account to save products.</p>
          <div className="mt-2 flex gap-3">
            <Link href="/signup" className="font-bold text-[#0c8b67] hover:underline">
              Create account
            </Link>
            <Link href="/login" className="font-bold text-[#17221f] hover:underline">
              Log in
            </Link>
          </div>
        </div>
      )}
      {error && <p className="absolute right-0 top-full mt-1 whitespace-nowrap text-xs font-semibold text-[#ef745f]">Could not update. Try again.</p>}
    </div>
  );
}
