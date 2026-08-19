import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on every matched request. Supabase's session
 * tokens expire; without this, a Server Component reading an expired token would see the user
 * as logged out even though their refresh token is still valid. Called from proxy.ts (Next.js
 * 16 renamed the `middleware.ts` convention to `proxy.ts` — see node_modules/next/dist/docs).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Do not remove: this call revalidates/refreshes the token. Without it, expired sessions
  // would only be caught the next time something explicitly calls getUser().
  await supabase.auth.getUser();

  return response;
}
