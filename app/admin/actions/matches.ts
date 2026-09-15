"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, AdminAuthError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { ACCEPT_ALL_BATCH_SIZE } from "@/lib/admin/matchBatch";

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

/**
 * Bulk-accept pending matches (§ user request). Three deliberate constraints:
 *
 * 1. **Capped per click.** Each accept is its own `accept_product_match` transaction, so N pending
 *    matches means N round trips. Doing 400+ in one Server Action invocation risks hitting a
 *    platform request timeout half-way, which would leave the operator with no idea how far it
 *    got. A bounded batch always finishes and reports exactly what it did; the button simply says
 *    how many are left.
 * 2. **Failures do not abort the batch.** A candidate decided by someone else in the meantime
 *    ("already decided") is skipped and counted, not treated as a fatal error — otherwise one
 *    stale row would block every remaining match behind it.
 * 3. **Oldest first.** Same order the reviewer sees on the page, so "accept all" and clicking
 *    through by hand converge on the same result.
 *
 * This is irreversible: `accept_product_match` moves offers/history/favourites/alerts onto the
 * canonical product and retires the duplicate, and there is no unmerge. The confirm dialog says so.
 */
export async function acceptAllMatchesAction(): Promise<{ error?: string; accepted?: number; skipped?: number; remaining?: number }> {
  const admin = await actAsAdmin();
  if (typeof admin === "string") return { error: admin };

  const { data: rows, error: listError } = await admin.supabase
    .from("product_match_candidates")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(ACCEPT_ALL_BATCH_SIZE);
  if (listError) return { error: "Could not load pending matches." };
  if (!rows?.length) return { accepted: 0, skipped: 0, remaining: 0 };

  let accepted = 0;
  let skipped = 0;
  for (const row of rows as { id: string }[]) {
    const { error } = await admin.supabase.rpc("accept_product_match", { p_candidate_id: row.id });
    if (error) { skipped += 1; continue; }
    accepted += 1;
  }

  // One audit entry for the batch rather than one per match: the operator performed a single
  // deliberate action, and 100 near-identical rows would bury everything else in the log.
  await logAdminAction(admin, "match.accept_all", "product_match_candidate", null, { accepted, skipped, batchSize: ACCEPT_ALL_BATCH_SIZE });

  const { count } = await admin.supabase.from("product_match_candidates").select("id", { count: "exact", head: true }).eq("status", "pending");

  revalidatePath("/admin/matches");
  revalidatePath("/admin/products");
  revalidatePath("/admin/data-quality");
  return { accepted, skipped, remaining: count ?? 0 };
}
