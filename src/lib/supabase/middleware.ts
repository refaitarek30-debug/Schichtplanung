import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieToSet } from "./cookies";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Erneuert die Supabase-Session bei jedem Request und liefert den
 * angemeldeten Benutzer zurück. `getUser()` validiert das Token gegen
 * Supabase – im Gegensatz zu `getSession()`, das dem Cookie vertraut.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
