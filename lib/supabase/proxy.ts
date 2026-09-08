import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/auth/signout" ||
    pathname === "/api/health" ||
    pathname === "/api/readiness";

  // Login must stay reachable for revoked/portal sessions. Public liveness and
  // readiness probes must not depend on Auth availability or refresh cookies.
  if (isPublicRoute) return response;

  const loginDestination = () => {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.search = "";
    destination.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return destination;
  };

  // A missing deployment configuration must never expose protected application routes.
  if (!url || !publishableKey) {
    return NextResponse.redirect(loginDestination());
  }

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  let signedIn = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    signedIn = !error && Boolean(data?.claims?.sub);
  } catch { /* Network failure must fail closed, not crash navigation. */ }

  if (!signedIn) {
    const redirectResponse = NextResponse.redirect(loginDestination());
    response.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}
