import { createClient } from "@/lib/supabase/client";
import { datenFehlerText } from "@/lib/errors";

/**
 * Lohnabrechnungen im Privatbereich (Migration 0204): privater Speicher je
 * Person, erst nach Einwilligung. Bilder werden vor dem Hochladen im Browser
 * verkleinert (JPEG), PDFs bleiben PDF. Höchstens 10 MB je Datei.
 */

export interface Lohnzettel {
  id: string;
  /** Erster des Monats, "2026-10-01" */
  monat: string;
  titel: string;
  pfad: string;
  typ: "image/jpeg" | "application/pdf";
  groesse: number;
  erstelltAm: string;
}

const BUCKET = "lohnzettel";
export const MAX_BYTES = 10 * 1024 * 1024;
const MAX_KANTE = 2000;

export class LohnzettelFehler extends Error {}

export async function einwilligungStand(): Promise<boolean> {
  const { data } = await createClient().from("privat_konten").select("lohnzettel_einwilligung").maybeSingle<{ lohnzettel_einwilligung: string | null }>();
  return !!data?.lohnzettel_einwilligung;
}

export async function setzeEinwilligung(an: boolean): Promise<void> {
  const { error } = await createClient().rpc("lohnzettel_einwilligung", { p_an: an });
  if (error) throw new LohnzettelFehler(datenFehlerText(error, "Das konnte nicht gespeichert werden."));
}

export async function ladeLohnzettel(): Promise<Lohnzettel[]> {
  const { data, error } = await createClient()
    .from("privat_lohnzettel")
    .select("id, monat, titel, pfad, typ, groesse, erstellt_am")
    .order("monat", { ascending: false })
    .order("erstellt_am", { ascending: false });
  if (error) throw new LohnzettelFehler(datenFehlerText(error, "Die Lohnabrechnungen konnten nicht geladen werden."));
  return ((data ?? []) as { id: string; monat: string; titel: string; pfad: string; typ: Lohnzettel["typ"]; groesse: number; erstellt_am: string }[]).map(
    (z) => ({ id: z.id, monat: z.monat, titel: z.titel, pfad: z.pfad, typ: z.typ, groesse: z.groesse, erstelltAm: z.erstellt_am }),
  );
}

/** Ein Foto auf höchstens 2000 px Kantenlänge als JPEG – meist 200 bis 600 KB. */
async function verkleinere(datei: File): Promise<Blob> {
  const url = URL.createObjectURL(datei);
  try {
    const bild = await new Promise<HTMLImageElement>((ok, nein) => {
      const b = new Image();
      b.onload = () => ok(b);
      b.onerror = () => nein(new LohnzettelFehler("Das Bild konnte nicht gelesen werden."));
      b.src = url;
    });
    const faktor = Math.min(1, MAX_KANTE / Math.max(bild.naturalWidth, bild.naturalHeight));
    const breite = Math.max(1, Math.round(bild.naturalWidth * faktor));
    const hoehe = Math.max(1, Math.round(bild.naturalHeight * faktor));
    const leinwand = document.createElement("canvas");
    leinwand.width = breite;
    leinwand.height = hoehe;
    const ctx = leinwand.getContext("2d");
    if (!ctx) throw new LohnzettelFehler("Das Bild konnte nicht verkleinert werden.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, breite, hoehe);
    ctx.drawImage(bild, 0, 0, breite, hoehe);
    const blob = await new Promise<Blob | null>((ok) => leinwand.toBlob(ok, "image/jpeg", 0.8));
    if (!blob) throw new LohnzettelFehler("Das Bild konnte nicht verkleinert werden.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function hochladen(datei: File, monat: string, titel: string): Promise<Lohnzettel> {
  const istPdf = datei.type === "application/pdf" || /\.pdf$/i.test(datei.name);
  if (!istPdf && !datei.type.startsWith("image/")) throw new LohnzettelFehler("Bitte ein Foto oder eine PDF-Datei wählen.");
  const inhalt: Blob = istPdf ? datei : await verkleinere(datei);
  if (inhalt.size > MAX_BYTES) throw new LohnzettelFehler("Die Datei ist größer als 10 MB.");
  const supabase = createClient();
  const { data: anspruch } = await supabase.auth.getClaims();
  const userId = anspruch?.claims?.sub;
  if (!userId) throw new LohnzettelFehler("Deine Sitzung ist abgelaufen.");
  const typ = istPdf ? "application/pdf" : "image/jpeg";
  const pfad = `${userId}/${crypto.randomUUID()}.${istPdf ? "pdf" : "jpg"}`;
  const { error: hochFehler } = await supabase.storage.from(BUCKET).upload(pfad, inhalt, { contentType: typ, upsert: false });
  if (hochFehler) throw new LohnzettelFehler("Das Hochladen hat nicht geklappt. Bitte versuch es noch einmal.");
  const { data, error } = await supabase
    .from("privat_lohnzettel")
    .insert({ user_id: userId, monat, titel: titel.trim().slice(0, 60), pfad, typ, groesse: inhalt.size })
    .select("id, erstellt_am")
    .single<{ id: string; erstellt_am: string }>();
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([pfad]);
    throw new LohnzettelFehler(datenFehlerText(error, "Das konnte nicht gespeichert werden."));
  }
  return { id: data.id, monat, titel: titel.trim().slice(0, 60), pfad, typ, groesse: inhalt.size, erstelltAm: data.erstellt_am };
}

/** Kurz gültiger Link zum Ansehen (2 Minuten). */
export async function ansehenLink(pfad: string): Promise<string> {
  const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(pfad, 120);
  if (error || !data) throw new LohnzettelFehler("Die Datei konnte nicht geöffnet werden.");
  return data.signedUrl;
}

export async function loeschen(z: Lohnzettel): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove([z.pfad]);
  // Falls das Entfernen oben nicht geklappt hat, räumt der Server die Datei nach (Migration 0204).
  const { error } = await supabase.from("privat_lohnzettel").delete().eq("id", z.id);
  if (error) throw new LohnzettelFehler(datenFehlerText(error, "Das konnte nicht gelöscht werden."));
}

export function groesseText(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
