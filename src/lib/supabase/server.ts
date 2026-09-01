import { cookies } from "next/headers";
import type { CookieToSet } from "./cookies";
import { createServerClient } from "@supabase/ssr";
import { createClient as createRawClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/** Supabase-Client für Server Components, Route Handler und Server Actions. */
export async function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // In Server Components ist Schreiben nicht erlaubt – die Middleware
          // erneuert die Session ohnehin bei jedem Request.
        }
      },
    },
  });
}

/**
 * Client mit Service-Role-Key. Ausschließlich serverseitig verwenden,
 * niemals importieren, wo Client-Code entsteht. Wird für Einladungen über
 * die Auth-Admin-API gebraucht.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured || !serviceKey) {
    throw new Error("Service-Role-Key ist nicht konfiguriert.");
  }
  return createRawClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
