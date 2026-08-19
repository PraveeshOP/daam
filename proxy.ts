import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same behavior, new name/export) — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets and image optimization requests — running auth refresh on every CSS/JS
    // request is pure overhead. Everything else (including RSC/data requests) still goes through.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
