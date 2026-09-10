import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Supabase-Client für Client Components.
 * Nutzt ausschließlich den Anon Key – jeder Zugriff wird zusätzlich
 * serverseitig durch Row Level Security geprüft.
 */
export function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
