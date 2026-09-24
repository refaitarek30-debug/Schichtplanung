import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";
import { installiereLadesperre } from "@/lib/ladesperre";

/**
 * Supabase-Client für Client Components – bewusst nur EINER pro Browser-Tab.
 *
 * Warum das wichtig ist: Jeder Client bringt eine eigene Sitzungsverwaltung
 * mit, samt Zeitgeber, der das Zugangstoken vor Ablauf erneuert. Supabase
 * dreht dabei das Erneuerungstoken weiter – das alte wird sofort ungültig.
 * Legt man den Client in jeder Datenfunktion neu an, laufen ein Dutzend
 * dieser Zeitgeber parallel: der erste erneuert, die anderen kommen mit dem
 * inzwischen ungültigen Token und bekommen "Refresh Token Not Found". Damit
 * ist die Sitzung weg, mitten im Betrieb, und jede Serveraktion – etwa eine
 * Einladung – scheitert mit "Sitzung abgelaufen".
 *
 * Genau das ist passiert. Ein einziger Client pro Tab behebt es.
 */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }
  if (!browserClient) {
    // Vor dem Anlegen: der Client merkt sich fetch – so zählt die
    // Ladesperre auch seine schreibenden Aufrufe.
    installiereLadesperre();
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return browserClient;
}
