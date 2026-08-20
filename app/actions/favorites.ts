"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/analytics/track";
import { getTrackingIdentity } from "@/lib/analytics/identity";

export type ToggleFavoriteResult =
  | { ok: true; favorited: boolean }
  | { ok: false; reason: "unauthenticated" | "error" };

/**
 * Toggles a product's favorite state for the signed-in user. Auth is re-checked here even
 * though the button also knows the auth state client-side — a Server Action is a public POST
 * endpoint, so it must never trust the caller (see the Next.js Server Actions security guide).
 * Row Level Security (see the favorites RLS policies) is the second, database-level guarantee.
 */
export async function toggleFavorite(productId: string): Promise<ToggleFavoriteResult> {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, reason: "unauthenticated" };

  const { data: existing, error: lookupError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();
  if (lookupError) return { ok: false, reason: "error" };

  const { anonymousId } = await getTrackingIdentity();

  if (existing) {
    const { error } = await supabase.from("favorites").delete().eq("id", existing.id);
    if (error) return { ok: false, reason: "error" };
    revalidatePath("/favorites");
    after(() => trackEvent({ eventName: "favorite_removed", userId: user.id, anonymousId, productId, properties: { product_id: productId } }));
    return { ok: true, favorited: false };
  }

  const { error } = await supabase.from("favorites").insert({ user_id: user.id, product_id: productId });
  if (error) return { ok: false, reason: "error" };
  revalidatePath("/favorites");
  after(() => trackEvent({ eventName: "favorite_added", userId: user.id, anonymousId, productId, properties: { product_id: productId } }));
  return { ok: true, favorited: true };
}
