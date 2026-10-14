import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

/**
 * Kalender mit Partner – siehe Migrationen 0138 und 0139.
 *
 * Inhaber (angemeldet): Einladung erstellen/beenden, Partnertage und
 * Termine lesen/setzen.
 * Partner (ohne Konto): mit dem Schlüssel aus dem Link den Plan des
 * Inhabers lesen und die eigenen Tage und Termine setzen.
 */

export type PartnerCode = "F" | "S" | "N" | "T" | "U" | "X";

export type Wiederholung = "nie" | "taeglich" | "woechentlich" | "monatlich";

export interface Termin {
  id: string;
  /** Vom Partner eingetragen (über den Link). */
  vonPartner: boolean;
  /** Erster Tag, "YYYY-MM-DD". */
  datum: string;
  titel: string;
  ganztaegig: boolean;
  von: string;
  bis: string;
  wiederholung: Wiederholung;
  notiz: string;
  ort: string;
}

/** Neuer Termin hat noch keine Id. */
export type TerminEingabe = Omit<Termin, "id" | "vonPartner"> & { id: string | null };

export class PartnerFehler extends Error {}

function fehler(error: Parameters<typeof dataErrorMessage>[0], standard: string): never {
  throw new PartnerFehler(dataErrorMessage(error) ?? standard);
}

const zeit = (t: string, ganz: boolean) => (ganz || !t ? null : t);

function terminParameter(t: TerminEingabe) {
  return {
    p_id: t.id,
    p_datum: t.datum,
    p_titel: t.titel,
    p_ganztaegig: t.ganztaegig,
    p_beginn: zeit(t.von, t.ganztaegig),
    p_ende: zeit(t.bis, t.ganztaegig),
    p_wiederholung: t.wiederholung,
    p_notiz: t.notiz,
    p_ort: t.ort,
  };
}

// ---- Inhaber ----------------------------------------------------------------

export async function fetchMeinePartnerTage(von: string, bis: string): Promise<Record<string, PartnerCode>> {
  if (!isSupabaseConfigured) return {};
  const { data, error } = await createClient().rpc("meine_partner_tage", { p_von: von, p_bis: bis });
  if (error) fehler(error, "Die Partnertage konnten nicht geladen werden.");
  const tage: Record<string, PartnerCode> = {};
  for (const z of (data ?? []) as { tag: string; schicht: PartnerCode }[]) tage[z.tag] = z.schicht;
  return tage;
}

export async function setzeMeinePartnerTage(von: string, anzahl: number, code: PartnerCode | null) {
  const { error } = await createClient().rpc("meine_partner_tage_setzen", {
    p_von: von,
    p_anzahl: anzahl,
    p_schicht: code,
  });
  if (error) fehler(error, "Das konnte nicht gespeichert werden.");
}

interface TerminZeile {
  id: string;
  von_partner: boolean;
  datum: string;
  titel: string;
  ganztaegig: boolean;
  beginn: string | null;
  ende: string | null;
  wiederholung: Wiederholung;
  notiz: string;
  ort: string;
}

export async function fetchMeineTermine(): Promise<Termin[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createClient().rpc("meine_termine");
  if (error) fehler(error, "Die Termine konnten nicht geladen werden.");
  return ((data ?? []) as TerminZeile[]).map((z) => ({
    id: z.id,
    vonPartner: z.von_partner,
    datum: z.datum,
    titel: z.titel,
    ganztaegig: z.ganztaegig,
    von: z.beginn ?? "",
    bis: z.ende ?? "",
    wiederholung: z.wiederholung,
    notiz: z.notiz,
    ort: z.ort,
  }));
}

export async function speichereTermin(t: TerminEingabe): Promise<string> {
  const { data, error } = await createClient().rpc("termin_speichern", terminParameter(t));
  if (error) fehler(error, "Der Termin konnte nicht gespeichert werden.");
  return data as string;
}

export async function loescheTermin(id: string) {
  const { error } = await createClient().rpc("termin_loeschen", { p_id: id });
  if (error) fehler(error, "Der Termin konnte nicht gelöscht werden.");
}

export interface EinladungStatus {
  aktiv: boolean;
  erstelltAm: string | null;
  zuletztGenutzt: string | null;
  termineTeilen: boolean;
}

export async function fetchEinladungStatus(): Promise<EinladungStatus> {
  const { data, error } = await createClient().rpc("partner_einladung_status");
  if (error) fehler(error, "Der Stand der Einladung konnte nicht geladen werden.");
  const z = (
    (data ?? []) as { erstellt_am: string; zuletzt_genutzt: string | null; termine_teilen: boolean }[]
  )[0];
  return z
    ? { aktiv: true, erstelltAm: z.erstellt_am, zuletztGenutzt: z.zuletzt_genutzt, termineTeilen: z.termine_teilen }
    : { aktiv: false, erstelltAm: null, zuletztGenutzt: null, termineTeilen: false };
}

/** Neuer Schlüssel – ein bestehender Link gilt danach nicht mehr. */
export async function erstelleEinladung(termineTeilen: boolean): Promise<string> {
  const { data, error } = await createClient().rpc("partner_einladen", { p_termine_teilen: termineTeilen });
  if (error || typeof data !== "string") fehler(error, "Die Einladung konnte nicht erstellt werden.");
  return data as string;
}

export async function setzeTermineTeilen(an: boolean) {
  const { error } = await createClient().rpc("partner_termine_teilen", { p_an: an });
  if (error) fehler(error, "Das konnte nicht gespeichert werden.");
}

export async function beendePartnerLink() {
  const { error } = await createClient().rpc("partner_link_beenden");
  if (error) fehler(error, "Der Zugang konnte nicht beendet werden.");
}

// ---- Partner (ohne Anmeldung) ---------------------------------------------

export interface PartnerKalender {
  name: string;
  termineGeteilt: boolean;
  /** Tag -> [Schicht des Inhabers, Schicht des Partners]. */
  tage: Map<string, [PartnerCode | null, PartnerCode | null]>;
  termine: Termin[];
}

export const LINK_UNGUELTIG = "Dieser Link ist nicht mehr gültig.";

function linkFehler(error: Parameters<typeof dataErrorMessage>[0] & { code?: string }, standard: string): never {
  // PT404 = „nicht gefunden“ (HTTP 404). P0002 lieferte die Datenbank bis
  // 14.10. – als HTTP 500, was in den Protokollen wie ein Serverfehler aussah.
  if (error?.code === "PT404" || error?.code === "P0002") throw new PartnerFehler(LINK_UNGUELTIG);
  fehler(error, standard);
}

export async function fetchPartnerKalender(token: string, von: string, tage: number): Promise<PartnerKalender> {
  const { data, error } = await createClient().rpc("partner_kalender", {
    p_token: token,
    p_von: von,
    p_tage: tage,
  });
  if (error) linkFehler(error, "Der Kalender konnte nicht geladen werden.");
  const roh = data as {
    name: string;
    termineGeteilt?: boolean;
    termine?: Termin[];
    tage: [string, PartnerCode | null, PartnerCode | null][];
  };
  const karte = new Map<string, [PartnerCode | null, PartnerCode | null]>();
  for (const [tag, eigen, partner] of roh?.tage ?? []) karte.set(tag, [eigen, partner]);
  return {
    name: roh?.name ?? "",
    termineGeteilt: roh?.termineGeteilt === true,
    tage: karte,
    termine: roh?.termine ?? [],
  };
}

export async function partnerTageSetzen(token: string, von: string, anzahl: number, code: PartnerCode | null) {
  const { error } = await createClient().rpc("partner_tage_setzen", {
    p_token: token,
    p_von: von,
    p_anzahl: anzahl,
    p_schicht: code,
  });
  if (error) linkFehler(error, "Das konnte nicht gespeichert werden.");
}

export async function partnerTerminSpeichern(token: string, t: TerminEingabe) {
  const { error } = await createClient().rpc("partner_termin_speichern", { p_token: token, ...terminParameter(t) });
  if (error) linkFehler(error, "Der Termin konnte nicht gespeichert werden.");
}

export async function partnerTerminLoeschen(token: string, id: string) {
  const { error } = await createClient().rpc("partner_termin_loeschen", { p_token: token, p_id: id });
  if (error) linkFehler(error, "Der Termin konnte nicht gelöscht werden.");
}
