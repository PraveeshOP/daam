import type { SupabaseServiceClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

export type RecordMatchCandidateInput = {
  newProductId: string;
  candidateProductId: string;
  storeId: string;
  confidence: number;
  reasons: string[];
};

/**
 * Persists one "medium confidence, not high enough to auto-merge" result from the matcher
 * (collectors/core/matcher.ts) so it shows up in /admin/matches instead of only being logged to
 * the console for the duration of one collection run. Never throws — a broken insert here must
 * not fail the product import it's attached to.
 */
export async function recordMatchCandidate(client: SupabaseServiceClient, input: RecordMatchCandidateInput): Promise<void> {
  const { error } = await client.from("product_match_candidates").upsert(
    {
      new_product_id: input.newProductId,
      candidate_product_id: input.candidateProductId,
      store_id: input.storeId,
      confidence: input.confidence,
      reasons: input.reasons,
    },
    { onConflict: "new_product_id,candidate_product_id", ignoreDuplicates: true },
  );
  if (error) logError("matches", `could not record match candidate for product ${input.newProductId}: ${error.message}`);
}

export type MatchCandidateView = {
  id: string;
  confidence: number;
  reasons: string[];
  status: string;
  storeName: string | null;
  newProduct: { id: string; name: string; brand: string; imageUrl: string | null };
  candidateProduct: { id: string; name: string; brand: string; imageUrl: string | null };
  createdAt: string;
  decidedAt: string | null;
};

const PAGE_SIZE = 15;

/** /admin/matches — the review queue for §12. Paginated and filterable by status so a large
 * backlog of decided matches doesn't need to load alongside the pending ones. */
export async function listMatchCandidates(status: "pending" | "accepted" | "rejected", page: number) {
  const supabase = await createServerSupabaseClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from("product_match_candidates")
    .select(
      "id, confidence, reasons, status, created_at, decided_at, stores(name), new:products!product_match_candidates_new_product_id_fkey(id, name, brand, image_url), candidate:products!product_match_candidates_candidate_product_id_fkey(id, name, brand, image_url)",
      { count: "exact" },
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error || !data) return { items: [] as MatchCandidateView[], total: 0, pageSize: PAGE_SIZE };

  type Row = {
    id: string; confidence: number; reasons: string[]; status: string; created_at: string; decided_at: string | null;
    stores: { name: string } | null;
    new: { id: string; name: string; brand: string; image_url: string | null } | null;
    candidate: { id: string; name: string; brand: string; image_url: string | null } | null;
  };

  const items = (data as unknown as Row[])
    .filter((row): row is Row & { new: NonNullable<Row["new"]>; candidate: NonNullable<Row["candidate"]> } => Boolean(row.new && row.candidate))
    .map((row) => ({
      id: row.id,
      confidence: Number(row.confidence),
      reasons: row.reasons,
      status: row.status,
      storeName: row.stores?.name ?? null,
      newProduct: { id: row.new.id, name: row.new.name, brand: row.new.brand, imageUrl: row.new.image_url },
      candidateProduct: { id: row.candidate.id, name: row.candidate.name, brand: row.candidate.brand, imageUrl: row.candidate.image_url },
      createdAt: row.created_at,
      decidedAt: row.decided_at,
    }));

  return { items, total: count ?? items.length, pageSize: PAGE_SIZE };
}
