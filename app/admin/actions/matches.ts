"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, AdminAuthError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";

async function actAsAdmin() {
  try {
    return await assertAdmin();
  } catch (error) {
    return error instanceof AdminAuthError ? error.message : "Not authorized.";
  }
}

/**
 * §13: calls the `accept_product_match` Postgres function (supabase/migrations/…admin_dashboard.sql),
 * which atomically moves offers/price history/favorites/alerts onto the canonical product and
 * retires the duplicate — all-or-nothing in one transaction, not a sequence of separate client
 * calls that could partially fail.
 */
export async function acceptMatchAction(formData: FormData): Promise<{ error?: string }> {
  const admin = await actAsAdmin();
  if (typeof admin === "string") return { error: admin };

  const candidateId = String(formData.get("candidateId") || "");
  if (!candidateId) return { error: "Invalid request." };

  const { error } = await admin.supabase.rpc("accept_product_match", { p_candidate_id: candidateId });
  if (error) return { error: error.message.includes("already decided") ? "This match was already decided." : "Could not accept the match." };

  await logAdminAction(admin, "match.accept", "product_match_candidate", candidateId);
  revalidatePath("/admin/matches");
  revalidatePath("/admin/products");
  revalidatePath("/admin/data-quality");
  return {};
}

/** §14: the two products stay separate — no data moves, just marks the candidate resolved. */
export async function rejectMatchAction(formData: FormData): Promise<{ error?: string }> {
  const admin = await actAsAdmin();
  if (typeof admin === "string") return { error: admin };

  const candidateId = String(formData.get("candidateId") || "");
  if (!candidateId) return { error: "Invalid request." };

  const { error } = await admin.supabase.rpc("reject_product_match", { p_candidate_id: candidateId });
  if (error) return { error: error.message.includes("already decided") ? "This match was already decided." : "Could not reject the match." };

  await logAdminAction(admin, "match.reject", "product_match_candidate", candidateId);
  revalidatePath("/admin/matches");
  revalidatePath("/admin/data-quality");
  return {};
}
