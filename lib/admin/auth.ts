import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * The server-side authorization gate for everything under /admin. Two entry points:
 *
 * - `getAdminSession()` — used by app/admin/layout.tsx to decide what to render (login prompt /
 *   "Access denied" / the dashboard). Never throws.
 * - `assertAdmin()` — used by every admin Server Action. Throws, because a Server Action is a
 *   public POST endpoint reachable without ever rendering the layout (see the Next.js Server
 *   Actions security guide) — page-level gating alone is not a security boundary.
 *
 * Both go through the session-scoped client from lib/supabase/server.ts, so the `profiles`
 * read (and every mutation an action goes on to perform) is still subject to RLS — this is
 * belt-and-suspenders with the `is_admin()` policies added in the phase-6 migration, not a
 * substitute for them.
 */

export type AdminSession =
  | { status: "unauthenticated" }
  | { status: "forbidden"; email: string }
  | { status: "ok"; userId: string; email: string };

export async function getAdminSession(): Promise<AdminSession> {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { status: "unauthenticated" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { status: "forbidden", email: user.email || "" };

  return { status: "ok", userId: user.id, email: user.email || "" };
}

export class AdminAuthError extends Error {}

export type AdminActor = { userId: string; email: string; supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> };

export async function assertAdmin(): Promise<AdminActor> {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new AdminAuthError("You must be logged in.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") throw new AdminAuthError("You do not have permission to do that.");

  return { userId: user.id, email: user.email || "", supabase };
}
