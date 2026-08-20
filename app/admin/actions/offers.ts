"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, AdminAuthError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";

const trimmed = (formData: FormData, name: string) => String(formData.get(name) || "").trim();

async function actAsAdmin() {
  try {
    return await assertAdmin();
  } catch (error) {
    return error instanceof AdminAuthError ? error.message : "Not authorized.";
  }
}

/** §17: "Disable offer" hides it from the public site entirely (is_disabled) without touching
 * its price history — never a delete. */
export async function setOfferDisabledAction(formData: FormData): Promise<{ error?: string }> {
  const admin = await actAsAdmin();
  if (typeof admin === "string") return { error: admin };

  const id = trimmed(formData, "offerId");
  const disabled = trimmed(formData, "disabled") === "true";
  if (!id) return { error: "Invalid request." };

  const { error } = await admin.supabase.from("offers").update({ is_disabled: disabled, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "Could not update the offer." };

  await logAdminAction(admin, disabled ? "offer.disable" : "offer.enable", "offer", id);
  revalidatePath("/admin/offers");
  revalidatePath("/admin/data-quality");
  return {};
}

/** §17: "Mark unavailable" — same field the collector itself sets, just admin-overridable when
 * a listing looks wrong before the next scheduled check. */
export async function setOfferAvailabilityAction(formData: FormData): Promise<{ error?: string }> {
  const admin = await actAsAdmin();
  if (typeof admin === "string") return { error: admin };

  const id = trimmed(formData, "offerId");
  const availability = trimmed(formData, "availability");
  if (!id || (availability !== "in_stock" && availability !== "out_of_stock")) return { error: "Invalid request." };

  const { error } = await admin.supabase.from("offers").update({ availability, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "Could not update the offer." };

  await logAdminAction(admin, "offer.mark_unavailable", "offer", id, { availability });
  revalidatePath("/admin/offers");
  revalidatePath("/admin/data-quality");
  return {};
}

/**
 * §6: sets (or clears) an offer's affiliate URL. Validated the same way `getStoreDestination`
 * validates it at read time — an admin can save a malformed URL here without it silently
 * breaking anything at click time, since /go/[offerId] always falls back to product_url.
 */
export async function setOfferAffiliateUrlAction(_prevState: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const admin = await actAsAdmin();
  if (typeof admin === "string") return { error: admin };

  const id = trimmed(formData, "offerId");
  const affiliateUrl = trimmed(formData, "affiliateUrl");
  if (!id) return { error: "Invalid request." };
  if (affiliateUrl && !/^https?:\/\//i.test(affiliateUrl)) return { error: "Affiliate URL must start with http:// or https://." };

  const { error } = await admin.supabase.from("offers").update({ affiliate_url: affiliateUrl || null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "Could not save the affiliate URL." };

  await logAdminAction(admin, "offer.set_affiliate_url", "offer", id, { hasUrl: Boolean(affiliateUrl) });
  revalidatePath("/admin/offers");
  return {};
}
