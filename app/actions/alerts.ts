"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { evaluateProductPriceAlerts } from "@/lib/alerts/evaluate";

export type AlertActionState = { error?: string; success?: string } | undefined;

function parseTargetPrice(raw: FormDataEntryValue | null): number | null {
  const value = Number(String(raw ?? "").trim());
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * Creates a price alert, or updates the existing one for this product (one alert per user per
 * product — see the unique(user_id, product_id) constraint). Re-activates a previously
 * triggered alert so the user can "create another alert" after the first one fired, per spec.
 */
export async function createOrUpdateAlertAction(_prevState: AlertActionState, formData: FormData): Promise<AlertActionState> {
  const productId = String(formData.get("productId") || "");
  if (!productId) return { error: "Something went wrong. Please try again." };

  const targetPrice = parseTargetPrice(formData.get("targetPrice"));
  if (targetPrice === null) return { error: "Please enter a valid price." };

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { error: "Please log in to set a price alert." };

  const { error } = await supabase
    .from("price_alerts")
    .upsert(
      { user_id: user.id, product_id: productId, target_price: targetPrice, is_active: true, triggered_at: null, updated_at: new Date().toISOString() },
      { onConflict: "user_id,product_id" },
    );
  if (error) return { error: "Could not save your alert. Please try again." };

  revalidatePath("/alerts");

  // If the target is already at/above the current lowest price, trigger right away instead of
  // waiting for the next scheduled collection — same pipeline hook the price worker uses.
  try {
    await evaluateProductPriceAlerts(createServiceClient(), productId);
  } catch (evaluationError) {
    console.error(`[alerts] immediate evaluation failed for product ${productId}:`, evaluationError);
  }

  return { success: "Price alert saved." };
}

export async function deleteAlertAction(formData: FormData): Promise<void> {
  const alertId = String(formData.get("alertId") || "");
  if (!alertId) return;

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  await supabase.from("price_alerts").delete().eq("id", alertId).eq("user_id", userData.user.id);
  revalidatePath("/alerts");
}
