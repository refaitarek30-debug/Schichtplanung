import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import { farbenAus, loescheTermin, speichereTermin, terminAusnahme, type FarbenCodes, type PartnerCode, type PersonArt, type Termin, type TerminEingabe } from "./partner";

/**
 * Verbundene Konten (Migration 0157): zwei Personen mit eigenem Kalender
 * verbinden sich per Code, QR-Code oder Link. Beide sehen die Schichten des
 * anderen; jede Seite entscheidet selbst über Termine und Eintragen.
 */

export interface Verbindung {
  id: string;
  /** Konto der anderen Person */
  partner: string;
  name: string;
  /** Wie ich die Person einordne */
  art: PersonArt;
  /** Die andere Person sieht meine Termine */
  ichTermine: boolean;
  /** Die andere Person darf bei mir eintragen */
  ichDarf: boolean;
  /** Ich sehe ihre Termine */
  erTermine: boolean;
  /** Ich darf bei ihr eintragen */
  erDarf: boolean;
  seit: string;
}

export interface CodeInfo {
  gueltig: boolean;
  name?: string;
  eigener?: boolean;
  schon?: boolean;
  uebernahme?: boolean;
}

class VerbindungsFehler extends Error {}

function fehler(error: Parameters<typeof dataErrorMessage>[0], standard: string): never {
  throw new VerbindungsFehler(dataErrorMessage(error) ?? standard);
}

/** "K7P4QX" -> "K7P-4QX" */
export function codeAnzeige(code: string): string {
  const c = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}

export async function fetchVerbindungen(): Promise<Verbindung[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createClient().rpc("meine_verbindungen");
  if (error) fehler(error, "Die Verbindungen konnten nicht geladen werden.");
  return (data ?? []) as Verbindung[];
}

export async function verbindungCodeErstellen(person: string | null): Promise<{ code: string; gueltigBis: string }> {
  const { data, error } = await createClient().rpc("verbindung_code_erstellen", { p_person: person });
  const z = data as { code?: string; gueltig_bis?: string } | null;
  if (error || !z?.code) fehler(error, "Der Code konnte nicht erstellt werden.");
  return { code: z!.code!, gueltigBis: z!.gueltig_bis! };
}

export async function verbindungCodeInfo(code: string): Promise<CodeInfo> {
  const { data, error } = await createClient().rpc("verbindung_code_info", { p_code: code });
  if (error) fehler(error, "Der Code konnte nicht geprüft werden.");
  return data as CodeInfo;
}

/** Gibt null zurück, wenn der Code nicht stimmt oder abgelaufen ist. */
export async function verbindungAnnehmen(code: string): Promise<string | null> {
  const { data, error } = await createClient().rpc("verbindung_annehmen", { p_code: code });
  if (error) fehler(error, "Das Verbinden hat nicht geklappt.");
  return (data as string | null) ?? null;
}

export async function verbindungAendern(id: string, art: PersonArt, termine: boolean, darf: boolean) {
  const { error } = await createClient().rpc("verbindung_aendern", {
    p_id: id,
    p_art: art,
    p_termine: termine,
    p_darf: darf,
  });
  if (error) fehler(error, "Das konnte nicht gespeichert werden.");
}

export async function verbindungBeenden(id: string) {
  const { error } = await createClient().rpc("verbindung_beenden", { p_id: id });
  if (error) fehler(error, "Die Verbindung konnte nicht beendet werden.");
}

/** Schichten der verbundenen Konten je Tag (höchstens 62 Tage), mit ihren Farben. */
export async function fetchVerbundeneTage(
  von: string,
  tage: number,
): Promise<Record<string, { tage: Record<string, PartnerCode>; farben: FarbenCodes }>> {
  if (!isSupabaseConfigured || tage < 1 || tage > 62) return {};
  const { data, error } = await createClient().rpc("verbundene_tage", { p_von: von, p_tage: tage });
  if (error) fehler(error, "Die Schichten der Verbundenen konnten nicht geladen werden.");
  const aus: Record<string, { tage: Record<string, PartnerCode>; farben: FarbenCodes }> = {};
  for (const z of (data ?? []) as { id: string; tage: Record<string, PartnerCode>; farben?: unknown }[]) {
    aus[z.id] = { tage: z.tage ?? {}, farben: farbenAus(z.farben) };
  }
  return aus;
}

interface FremdZeile {
  id: string;
  inhaber: string;
  von_user: string | null;
  datum: string;
  bis_datum: string | null;
  titel: string;
  ganztaegig: boolean;
  beginn: string | null;
  ende: string | null;
  wiederholung: Termin["wiederholung"];
  notiz: string;
  ort: string;
  ausfaelle?: string[] | null;
  serie_ab?: string | null;
}

/** Termine der Verbundenen, die sie mit mir teilen, und meine Einträge bei ihnen. */
export async function fetchVerbundeneTermine(): Promise<Termin[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createClient().rpc("verbundene_termine");
  if (error) fehler(error, "Die Termine der Verbundenen konnten nicht geladen werden.");
  return ((data ?? []) as FremdZeile[]).map((z) => ({
    id: z.id,
    vonPartner: true,
    personId: null,
    inhaber: z.inhaber,
    vonUser: z.von_user,
    datum: z.datum,
    bisDatum: z.bis_datum,
    titel: z.titel,
    ganztaegig: z.ganztaegig,
    von: z.beginn ?? "",
    bis: z.ende ?? "",
    wiederholung: z.wiederholung,
    notiz: z.notiz,
    ort: z.ort,
    ausfaelle: z.ausfaelle ?? [],
    serieAb: z.serie_ab ?? null,
  }));
}

/** Termin im Kalender einer verbundenen Person eintragen bzw. dort ändern. */
export async function verbindungTerminSpeichern(partner: string, t: TerminEingabe) {
  const { error } = await createClient().rpc("verbindung_termin_speichern", {
    p_partner: partner,
    p_id: t.id,
    p_datum: t.datum,
    p_bis_datum: t.ganztaegig && t.bisDatum && t.bisDatum > t.datum ? t.bisDatum : null,
    p_titel: t.titel,
    p_ganztaegig: t.ganztaegig,
    p_beginn: t.ganztaegig || !t.von ? null : t.von,
    p_ende: t.ganztaegig || !t.bis ? null : t.bis,
    p_wiederholung: t.wiederholung,
    p_notiz: t.notiz,
    p_ort: t.ort,
  });
  if (error) fehler(error, "Der Termin konnte nicht gespeichert werden.");
}

export async function verbindungTerminLoeschen(id: string) {
  const { error } = await createClient().rpc("verbindung_termin_loeschen", { p_id: id });
  if (error) fehler(error, "Der Termin konnte nicht gelöscht werden.");
}

/**
 * Termin speichern – je nachdem, wem er gehört: eigener Kalender, Termin
 * bei einer verbundenen Person (bestehend) oder neu bei ihr (ziel).
 */
export async function terminSichernUeberall(t: TerminEingabe, alt: Termin | null) {
  if (alt?.inhaber) return verbindungTerminSpeichern(alt.inhaber, { ...t, id: alt.id });
  if (!alt && t.ziel) return verbindungTerminSpeichern(t.ziel, { ...t, id: null });
  await speichereTermin(t);
}

export async function terminLoeschenUeberall(t: Termin) {
  if (t.inhaber) return verbindungTerminLoeschen(t.id);
  await loescheTermin(t.id);
}

/** Was beim Löschen eines wiederholenden Termins wegfällt. */
export type LoeschModus = "alle" | "dieser" | "ab";

/** Löschen mit Wahl: alle, nur der Tag `datum` oder ab diesem Tag. */
export async function terminLoeschenModus(t: Termin, modus: LoeschModus, datum: string) {
  if (modus === "alle" || t.wiederholung === "nie") return terminLoeschenUeberall(t);
  await terminAusnahme(t.id, datum, modus === "ab");
}
