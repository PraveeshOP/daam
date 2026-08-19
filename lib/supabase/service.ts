import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type SupabaseServiceClient = ReturnType<typeof createClient<Database>>;

/**
 * Server-only client authenticated with the service-role key. Bypasses Row Level Security by
 * design — only for trusted backend code that has already established ownership itself: the
 * collector/import pipeline, the price-alert evaluator, and the notification email worker.
 * Never import this from a Server Action that handles a user-initiated request (use
 * lib/supabase/server.ts there instead, so RLS enforces ownership).
 */
export function createServiceClient(): SupabaseServiceClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required for server-side writes.");
  return createClient<Database>(url, serviceKey);
}
