import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers. Reads the user's
 * session from cookies and uses the anon key, so every query is still subject to Row Level
 * Security — this is what makes "a user can only see their own favorites/alerts" a database
 * guarantee rather than a frontend check (see supabase/migrations for the RLS policies).
 *
 * `cookieStore.set` throws when called from a Server Component (only Server Actions/Route
 * Handlers may set cookies); that's expected and safe to ignore here because proxy.ts refreshes
 * the session on every request anyway.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component render — proxy.ts already keeps the session fresh.
          }
        },
      },
    },
  );
}

/** Convenience helper for the common "who is signed in, if anyone" check. */
export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
