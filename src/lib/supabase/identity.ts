import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";

/**
 * Wer bin ich – einmal ermitteln, dann im Speicher behalten.
 *
 * Fast jede Datenfunktion brauchte bisher zuerst `auth.getUser()` und danach
 * eine Abfrage auf `profiles`, um an die eigene Mitarbeiter-ID zu kommen.
 * Bei sieben parallelen Abfragen auf dem Dashboard sind das vierzehn
 * zusätzliche Anfragen – in den Supabase-Protokollen waren es über 500
 * `/user`-Aufrufe in einer Stunde. Jeder davon ist eine Gelegenheit für ein
 * Rennen beim Token-Erneuern.
 *
 * Das Ergebnis gilt für die Lebensdauer der Seite. Beim Ab- und Anmelden
 * wird es verworfen (siehe `watchAuthChanges`).
 */
export interface Identity {
  userId: string;
  employeeId: string | null;
  companyId: string | null;
}

let pending: Promise<Identity | null> | null = null;
/** Für welches Konto `pending` gilt. */
let pendingFuer: string | null = null;
let watching = false;

function watchAuthChanges() {
  if (watching || !isSupabaseConfigured) return;
  watching = true;
  createClient().auth.onAuthStateChange((event) => {
    // Anmeldung, Abmeldung, Benutzerwechsel: gemerkte Identität verwerfen.
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      forgetIdentity();
    }
  });
}

export function forgetIdentity() {
  pending = null;
  pendingFuer = null;
}

/**
 * An- und Abmelden laufen über Server-Aktionen: Die Cookies wechseln, die
 * Seite lädt aber nicht neu, und `onAuthStateChange` meldet das nicht
 * zuverlässig. Ohne diese Prüfung blieb nach einem Kontowechsel auf
 * demselben Gerät die Mitarbeiter-ID des vorigen Kontos gemerkt – das
 * Urlaubskonto stand dann auf „0 von 0“ und die V-Tage-Kachel fehlte.
 * Deshalb wird vor jeder Nutzung mit der aktuellen Sitzung verglichen
 * (aus dem Cookie, ohne Netzwerk).
 */
export async function currentIdentity(): Promise<Identity | null> {
  if (!isSupabaseConfigured) return null;
  watchAuthChanges();

  const {
    data: { session },
  } = await createClient().auth.getSession();
  const sitzungFuer = session?.user?.id ?? null;
  if (pending && pendingFuer !== sitzungFuer) pending = null;

  if (!pending) {
    pendingFuer = sitzungFuer;
    pending = (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select("employee_id, company_id")
        .eq("id", user.id)
        .returns<{ employee_id: string | null; company_id: string }[]>()
        .maybeSingle();

      return {
        userId: user.id,
        employeeId: data?.employee_id ?? null,
        companyId: data?.company_id ?? null,
      };
    })().catch((caught) => {
      // Bei einem Fehler nicht dauerhaft merken – der nächste Versuch soll
      // es erneut probieren dürfen.
      pending = null;
      pendingFuer = null;
      throw caught;
    });
  }

  return pending;
}
