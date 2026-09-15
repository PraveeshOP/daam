import type { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = ReturnType<typeof createClient<Database>>;

export type SlugOwner = { id: string; status: string; merged_into: string | null };

/**
 * Resolves the product that currently owns a generated slug, following any merge chain.
 *
 * Why this exists — the `products_slug_key` deadlock found during the full-catalogue sweep
 * (31 dropped imports in one run):
 *
 *  1. An admin accepts a product match. `accept_product_match` retires the duplicate
 *     (`status='inactive'`, `merged_into=<canonical>`) but leaves its `slug` row in place, still
 *     occupying the unique index.
 *  2. That same function *deletes* the duplicate's offer whenever the canonical product already
 *     has one from the same store — it has to, or it would violate `unique(product_id, store_id)`.
 *  3. The next collection run sees the store still listing that product. The
 *     `offers.external_id` lookup now finds nothing, because that offer was the one deleted.
 *  4. The matcher scores below 75, so the importer tries to *create* a product — regenerating the
 *     exact same slug from the exact same externalId.
 *  5. The insert fails on the retired row's slug, the item is dropped, and the offer is never
 *     recreated. It repeats on every future run: that listing can never be imported again.
 *
 * Resolving the slug to the canonical product breaks the loop and self-heals rows already stuck.
 */
export async function resolveSlugOwner(client: Client, slug: string): Promise<SlugOwner | null> {
  const { data, error } = await client.from("products").select("id, status, merged_into").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`slug lookup failed: ${error.message}`);
  return (data as SlugOwner | null) ?? null;
}

/**
 * Follows `merged_into` to the surviving product. Bounded rather than recursive-until-null: a
 * cycle (A merged into B, B merged into A) would otherwise hang the collector forever, and
 * nothing in the schema prevents one.
 */
export async function resolveCanonicalProductId(client: Client, start: SlugOwner, maxHops = 10): Promise<string> {
  let current = start;
  for (let hop = 0; hop < maxHops; hop++) {
    if (!current.merged_into) return current.id;
    const { data, error } = await client.from("products").select("id, status, merged_into").eq("id", current.merged_into).maybeSingle();
    if (error) throw new Error(`merge chain lookup failed: ${error.message}`);
    // A dangling merged_into (target deleted) leaves this row as the best answer available.
    if (!data) return current.id;
    current = data as SlugOwner;
  }
  return current.id;
}
