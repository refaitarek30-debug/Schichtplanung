"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Löschen im Betreiber-Bereich (Migration 0182).
 *
 * Jede Aktion prüft für sich, ob der Aufrufer Betreiber ist – eine
 * Server-Aktion ist ein öffentlich erreichbarer Endpunkt, die Seite
 * davor schützt sie nicht. Zusätzlich muss das Wort LÖSCHEN mitgeschickt
 * werden; die Oberfläche fragt danach, der Server prüft es noch einmal.
 */

export interface LoeschErgebnis {
  ok?: string;
  fehler?: string;
}

const BESTAETIGUNG = "LÖSCHEN";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function betreiber() {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }
  const { data } = await admin.rpc("is_platform_admin", { p_user_id: user.id });
  return data === true ? { admin, userId: user.id } : null;
}

function ids(roh: string[]): string[] | null {
  const liste = [...new Set(roh)];
  if (liste.length === 0 || liste.length > 50 || !liste.every((i) => UUID.test(i))) return null;
  return liste;
}

function freigegeben(wort: string): boolean {
  return wort.trim().toUpperCase() === BESTAETIGUNG;
}

/** Firmen in den Papierkorb: Zugänge gesperrt, Daten bleiben 14 Tage. */
export async function firmenInPapierkorb(firmen: string[], bestaetigung: string): Promise<LoeschErgebnis> {
  const b = await betreiber();
  if (!b) return { fehler: "Keine Berechtigung." };
  const liste = ids(firmen);
  if (!liste) return { fehler: "Bitte mindestens eine Firma auswählen." };
  if (!freigegeben(bestaetigung)) return { fehler: "Bitte zur Bestätigung LÖSCHEN eintippen." };

  let geschafft = 0;
  const probleme: string[] = [];
  for (const id of liste) {
    const { error } = await b.admin.rpc("plattform_firma_papierkorb", { p_company: id, p_in: true });
    if (error) probleme.push(error.message);
    else geschafft += 1;
  }
  revalidatePath("/plattform");
  if (probleme.length) {
    return { fehler: `${geschafft} in den Papierkorb gelegt. Nicht möglich: ${[...new Set(probleme)].join(" ")}` };
  }
  return { ok: `${geschafft} ${geschafft === 1 ? "Firma liegt" : "Firmen liegen"} jetzt 14 Tage im Papierkorb.` };
}

export async function firmaZurueckholen(firma: string): Promise<LoeschErgebnis> {
  const b = await betreiber();
  if (!b) return { fehler: "Keine Berechtigung." };
  if (!UUID.test(firma)) return { fehler: "Ungültige Firma." };
  const { error } = await b.admin.rpc("plattform_firma_papierkorb", { p_company: firma, p_in: false });
  revalidatePath("/plattform");
  if (error) return { fehler: "Das Zurückholen hat nicht geklappt." };
  return { ok: "Die Firma ist wieder da, die Zugänge sind freigeschaltet." };
}

/** Sofort endgültig – nur für Firmen, die schon im Papierkorb liegen. */
export async function firmaEndgueltig(firma: string, bestaetigung: string): Promise<LoeschErgebnis> {
  const b = await betreiber();
  if (!b) return { fehler: "Keine Berechtigung." };
  if (!UUID.test(firma)) return { fehler: "Ungültige Firma." };
  if (!freigegeben(bestaetigung)) return { fehler: "Bitte zur Bestätigung LÖSCHEN eintippen." };
  const { error } = await b.admin.rpc("firma_endgueltig_loeschen", { p_company: firma });
  revalidatePath("/plattform");
  if (error) return { fehler: "Endgültiges Löschen geht nur für Firmen im Papierkorb." };
  return { ok: "Die Firma und alle ihre Daten sind endgültig gelöscht." };
}

/** Privatkonten löschen – sofort, ohne Papierkorb. */
export async function privatkontenLoeschen(konten: string[], bestaetigung: string): Promise<LoeschErgebnis> {
  const b = await betreiber();
  if (!b) return { fehler: "Keine Berechtigung." };
  const liste = ids(konten);
  if (!liste) return { fehler: "Bitte mindestens ein Konto auswählen." };
  if (!freigegeben(bestaetigung)) return { fehler: "Bitte zur Bestätigung LÖSCHEN eintippen." };

  let geschafft = 0;
  let uebersprungen = 0;
  for (const id of liste) {
    // Nur echte Privatkonten, nie das eigene oder ein Betreiber-Konto, nie ein Firmenzugang.
    const [{ data: privat }, { data: istBetreiber }, { data: profil }] = await Promise.all([
      b.admin.rpc("ist_privatkonto", { p_user: id }),
      b.admin.rpc("is_platform_admin", { p_user_id: id }),
      b.admin.from("profiles").select("id").eq("id", id).maybeSingle(),
    ]);
    if (id === b.userId || privat !== true || istBetreiber === true || profil) {
      uebersprungen += 1;
      continue;
    }
    const { error } = await b.admin.auth.admin.deleteUser(id);
    if (error) {
      uebersprungen += 1;
      continue;
    }
    await b.admin.from("plattform_protokoll").insert({ aktion: "endgueltig", art: "privat" });
    geschafft += 1;
  }
  revalidatePath("/plattform");
  if (uebersprungen) return { fehler: `${geschafft} gelöscht, ${uebersprungen} nicht (eigenes Konto, Betreiber oder kein Privatkonto).` };
  return { ok: `${geschafft} ${geschafft === 1 ? "Privatkonto" : "Privatkonten"} gelöscht.` };
}
