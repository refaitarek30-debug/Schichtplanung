"use server";

import { betreiberPruefen, betreiberProtokoll } from "@/lib/auth/betreiber";
import type { SchluesselZeile } from "./krypto";

/**
 * Unterlagen & Tresor. Jede Aktion prüft für sich: Betreiber mit vollem
 * Recht und Zwei-Faktor-Code. Der Server bekommt und liefert nur
 * Geheimtext – entschlüsselt wird im Browser (./krypto.ts).
 */

const BUCKET = "konsole-tresor";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const B64 = /^[A-Za-z0-9+/=]+$/;
const KEIN_RECHT = "Dafür brauchst du vollen Zugriff auf die Konsole (mit Zwei-Faktor-Code).";
const MAX_DATEI = 25 * 1024 * 1024;

export interface TresorEintrag {
  id: string;
  art: "eintrag" | "datei";
  daten: string;
  groesse: number | null;
  created_at: string;
  updated_at: string;
}

export type TresorStand =
  | { error: string }
  | { schluessel: SchluesselZeile | null; eintraege: TresorEintrag[] };

function zeileOk(z: SchluesselZeile): boolean {
  return (
    typeof z?.salz === "string" &&
    typeof z?.schluessel === "string" &&
    B64.test(z.salz) &&
    B64.test(z.schluessel) &&
    z.schluessel.length < 200 &&
    Number.isInteger(z.runden) &&
    z.runden >= 100_000 &&
    z.runden <= 5_000_000
  );
}

export async function tresorLaden(): Promise<TresorStand> {
  const b = await betreiberPruefen({ aendern: true });
  if (!b) return { error: KEIN_RECHT };
  const [s, e] = await Promise.all([
    b.admin.from("konsole_tresor_schluessel").select("salz, runden, schluessel").eq("id", 1).maybeSingle(),
    b.admin.from("konsole_tresor").select("id, art, daten, groesse, created_at, updated_at").order("created_at", { ascending: false }),
  ]);
  if (s.error || e.error) return { error: "Der Tresor fehlt noch in der Datenbank (Migration 0234)." };
  return { schluessel: (s.data as SchluesselZeile | null) ?? null, eintraege: (e.data as TresorEintrag[]) ?? [] };
}

/** Wird nach erfolgreichem Entsperren aufgerufen – nur fürs Protokoll. */
export async function tresorGeoeffnet(): Promise<void> {
  const b = await betreiberPruefen({ aendern: true });
  if (b) await betreiberProtokoll(b, "geoeffnet", "tresor");
}

export async function tresorAnlegen(z: SchluesselZeile): Promise<{ ok?: boolean; error?: string }> {
  const b = await betreiberPruefen({ aendern: true });
  if (!b) return { error: KEIN_RECHT };
  if (!zeileOk(z)) return { error: "Ungültige Daten." };
  const { error } = await b.admin
    .from("konsole_tresor_schluessel")
    .insert({ id: 1, salz: z.salz, runden: z.runden, schluessel: z.schluessel, geaendert_von: b.userId });
  if (error) return { error: "Es gibt schon einen Tresor – bitte Seite neu laden." };
  await betreiberProtokoll(b, "angelegt", "tresor");
  return { ok: true };
}

/** Neues Master-Passwort: nur wenn der alte verpackte Schlüssel noch aktuell ist. */
export async function masterSpeichern(alt: string, z: SchluesselZeile): Promise<{ ok?: boolean; error?: string }> {
  const b = await betreiberPruefen({ aendern: true });
  if (!b) return { error: KEIN_RECHT };
  if (!zeileOk(z) || typeof alt !== "string") return { error: "Ungültige Daten." };
  const { data, error } = await b.admin
    .from("konsole_tresor_schluessel")
    .update({ salz: z.salz, runden: z.runden, schluessel: z.schluessel, geaendert_von: b.userId, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .eq("schluessel", alt)
    .select("id");
  if (error || !data?.length) return { error: "Jemand hat das Master-Passwort inzwischen geändert. Bitte neu laden." };
  await betreiberProtokoll(b, "master_geaendert", "tresor");
  return { ok: true };
}

export async function eintragSpeichern(id: string | null, daten: string): Promise<{ id?: string; error?: string }> {
  const b = await betreiberPruefen({ aendern: true });
  if (!b) return { error: KEIN_RECHT };
  if (typeof daten !== "string" || !B64.test(daten) || daten.length > 200_000) return { error: "Der Eintrag ist zu groß." };
  if (id) {
    if (!UUID.test(id)) return { error: "Unbekannter Eintrag." };
    const { error } = await b.admin.from("konsole_tresor").update({ daten, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return { error: "Speichern hat nicht geklappt." };
    await betreiberProtokoll(b, "gespeichert", "tresor");
    return { id };
  }
  const { data, error } = await b.admin
    .from("konsole_tresor")
    .insert({ art: "eintrag", daten, erstellt_von: b.userId })
    .select("id")
    .single();
  if (error || !data) return { error: "Speichern hat nicht geklappt." };
  await betreiberProtokoll(b, "gespeichert", "tresor");
  return { id: data.id as string };
}

/** Ein signierter Link zum Hochladen der (schon verschlüsselten) Datei. */
export async function dateiVorbereiten(groesse: number): Promise<{ pfad?: string; token?: string; error?: string }> {
  const b = await betreiberPruefen({ aendern: true });
  if (!b) return { error: KEIN_RECHT };
  if (!Number.isFinite(groesse) || groesse <= 0 || groesse > MAX_DATEI) return { error: "Höchstens 25 MB je Datei." };
  const pfad = crypto.randomUUID();
  const { data, error } = await b.admin.storage.from(BUCKET).createSignedUploadUrl(pfad);
  if (error || !data) return { error: "Hochladen ist gerade nicht möglich (Migration 0234 eingespielt?)." };
  return { pfad, token: data.token };
}

export async function dateiEintragen(pfad: string, daten: string, groesse: number): Promise<{ id?: string; error?: string }> {
  const b = await betreiberPruefen({ aendern: true });
  if (!b) return { error: KEIN_RECHT };
  if (!UUID.test(pfad) || !B64.test(daten) || daten.length > 200_000) return { error: "Ungültige Daten." };
  const { data, error } = await b.admin
    .from("konsole_tresor")
    .insert({ art: "datei", daten, datei_pfad: pfad, groesse: Math.round(groesse), erstellt_von: b.userId })
    .select("id")
    .single();
  if (error || !data) {
    await b.admin.storage.from(BUCKET).remove([pfad]);
    return { error: "Speichern hat nicht geklappt." };
  }
  await betreiberProtokoll(b, "hochgeladen", "tresor");
  return { id: data.id as string };
}

/** Kurzlebiger Link (60 Sekunden) auf die verschlüsselte Datei. */
export async function dateiLink(id: string): Promise<{ url?: string; error?: string }> {
  const b = await betreiberPruefen({ aendern: true });
  if (!b) return { error: KEIN_RECHT };
  if (!UUID.test(id)) return { error: "Unbekannte Datei." };
  const { data: zeile } = await b.admin.from("konsole_tresor").select("datei_pfad").eq("id", id).maybeSingle();
  if (!zeile?.datei_pfad) return { error: "Unbekannte Datei." };
  const { data, error } = await b.admin.storage.from(BUCKET).createSignedUrl(zeile.datei_pfad as string, 60);
  if (error || !data) return { error: "Die Datei lässt sich gerade nicht laden." };
  await betreiberProtokoll(b, "heruntergeladen", "tresor");
  return { url: data.signedUrl };
}

export async function eintragLoeschen(id: string): Promise<{ ok?: boolean; error?: string }> {
  const b = await betreiberPruefen({ aendern: true });
  if (!b) return { error: KEIN_RECHT };
  if (!UUID.test(id)) return { error: "Unbekannter Eintrag." };
  const { data: zeile } = await b.admin.from("konsole_tresor").select("datei_pfad").eq("id", id).maybeSingle();
  if (zeile?.datei_pfad) await b.admin.storage.from(BUCKET).remove([zeile.datei_pfad as string]);
  const { error } = await b.admin.from("konsole_tresor").delete().eq("id", id);
  if (error) return { error: "Löschen hat nicht geklappt." };
  await betreiberProtokoll(b, "geloescht", "tresor");
  return { ok: true };
}
