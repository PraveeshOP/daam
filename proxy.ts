import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";
import { ANONYMOUS_ID_COOKIE } from "@/lib/analytics/identity";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same behavior, new name/export) — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
export async function proxy(request: NextRequest) {
  // Assign the anonymous analytics id (if this visitor doesn't have one yet) on the *request*
  // before generating the response, the same trick updateSession uses for the Supabase session
  // cookie — otherwise the current render wouldn't see the cookie it just set (the browser only
  // sends it back on the *next* request).
  let anonymousId = request.cookies.get(ANONYMOUS_ID_COOKIE)?.value;
  if (!anonymousId) {
    anonymousId = crypto.randomUUID();
    request.cookies.set(ANONYMOUS_ID_COOKIE, anonymousId);
  }

  const response = await updateSession(request);
  response.cookies.set(ANONYMOUS_ID_COOKIE, anonymousId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = {
  matcher: [
    // Skip static assets and image optimization requests — running auth refresh on every CSS/JS
    // request is pure overhead. Everything else (including RSC/data requests) still goes through.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
