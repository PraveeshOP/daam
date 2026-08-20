import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Set by proxy.ts on first visit — a random id with no relation to the visitor's real identity,
 * used only to group anonymous events together (§5). Never merged onto their account after
 * login: an event recorded before signing in stays anonymous_id-only, one recorded after has
 * both fields, and nothing goes back and relinks the two (§5: "do not ... attempt unnecessary
 * identity reconstruction"). */
export const ANONYMOUS_ID_COOKIE = "pn_aid";

export type TrackingIdentity = { userId: string | null; anonymousId: string | null };

/** For Server Components/Server Actions only (uses next/headers) — the worker resolves identity
 * differently (it already has the user_id from the row it's processing, no cookies involved). */
export async function getTrackingIdentity(): Promise<TrackingIdentity> {
  const cookieStore = await cookies();
  const anonymousId = cookieStore.get(ANONYMOUS_ID_COOKIE)?.value ?? null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return { userId: data.user?.id ?? null, anonymousId };
}
