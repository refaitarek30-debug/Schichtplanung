import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage, datenFehlerText } from "@/lib/errors";

/**
 * Kalender mit Partner – siehe Migrationen 0138 und 0139.
 *
 * Inhaber (angemeldet): Einladung erstellen/beenden, Partnertage und
 * Termine lesen/setzen.
 * Partner (ohne Konto): mit dem Schlüssel aus dem Link den Plan des
 * Inhabers lesen und die eigenen Tage und Termine setzen.
 */

export type PartnerCode = "F" | "S" | "N" | "T" | "U" | "X";

/** Eigene Farben einer Person für die Schichtarten (fehlt eine: Standardfarbe). */
export type FarbenCodes = Partial<Record<PartnerCode, string>>;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Nur gültige Farben übernehmen, was die Datenbank liefert. */
export function farbenAus(roh: unknown): FarbenCodes {
  const aus: FarbenCodes = {};
  if (roh && typeof roh === "object") {
    for (const [k, v] of Object.entries(roh as Record<string, unknown>)) {
      if ("FSNTUX".includes(k) && k.length === 1 && typeof v === "string" && HEX.test(v)) aus[k as PartnerCode] = v;
    }
  }
  return aus;
}

export type Wiederholung = "nie" | "taeglich" | "woechentlich" | "monatlich" | "jaehrlich";

/**
 * Erinnerung vor einem Termin (Migration 0154). Mit Uhrzeit: 10 Minuten,
 * 1 Stunde, 1 Tag vorher, morgens um 8. Ganztägig: am Vortag um 18 Uhr,
 * am Tag um 8 Uhr, 2 Tage vorher.
 */
export type Erinnerung = "m10" | "h1" | "d1" | "morgens8" | "vortag18" | "tag8" | "d2";

export interface Termin {
  id: string;
  /** Von einer eingeladenen Person eingetragen (über ihren Link). */
  vonPartner: boolean;
  /** Welche Person ihn eingetragen hat – nur in der eigenen Ansicht. */
  personId?: string | null;
  /** Termin aus dem Kalender eines verbundenen Kontos: dessen Konto. */
  inhaber?: string;
  /** Von einem verbundenen Konto eingetragen (Migration 0157). */
  vonUser?: string | null;
  /** Erster Tag, "YYYY-MM-DD". */
  datum: string;
  /** Letzter Tag, wenn ein ganztägiger Termin mehrere Tage dauert. */
  bisDatum?: string | null;
  titel: string;
  ganztaegig: boolean;
  von: string;
  bis: string;
  wiederholung: Wiederholung;
  notiz: string;
  ort: string;
  erinnerung?: Erinnerung | null;
  /** Tage, an denen ein wiederholender Termin ausfällt, "YYYY-MM-DD". */
  ausfaelle?: string[];
  /** Ab diesem Tag (einschließlich) gibt es keine Wiederholungen mehr. */
  serieAb?: string | null;
}

/** Neuer Termin hat noch keine Id. */
export type TerminEingabe = Omit<Termin, "id" | "vonPartner" | "personId" | "inhaber" | "vonUser" | "ausfaelle" | "serieAb"> & {
  id: string | null;
  /** In den Kalender eines verbundenen Kontos eintragen (dessen Konto). */
  ziel?: string | null;
};

export class PartnerFehler extends Error {}

function fehler(error: Parameters<typeof dataErrorMessage>[0], standard: string): never {
  throw new PartnerFehler(datenFehlerText(error, standard));
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
  person_id?: string | null;
  von_user?: string | null;
  datum: string;
  bis_datum?: string | null;
  erinnerung?: Erinnerung | null;
  ausfaelle?: string[] | null;
  serie_ab?: string | null;
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
    personId: z.person_id ?? null,
    vonUser: z.von_user ?? null,
    datum: z.datum,
    bisDatum: z.bis_datum ?? null,
    titel: z.titel,
    ganztaegig: z.ganztaegig,
    von: z.beginn ?? "",
    bis: z.ende ?? "",
    wiederholung: z.wiederholung,
    notiz: z.notiz,
    ort: z.ort,
    erinnerung: z.erinnerung ?? null,
    ausfaelle: z.ausfaelle ?? [],
    serieAb: z.serie_ab ?? null,
  }));
}

export async function speichereTermin(t: TerminEingabe): Promise<string> {
  const { data, error } = await createClient().rpc("termin_sichern", {
    ...terminParameter(t),
    p_bis_datum: t.ganztaegig && t.bisDatum && t.bisDatum > t.datum ? t.bisDatum : null,
    p_erinnerung: t.erinnerung ?? null,
  });
  if (error) fehler(error, "Der Termin konnte nicht gespeichert werden.");
  return data as string;
}

export async function loescheTermin(id: string) {
  const { error } = await createClient().rpc("termin_loeschen", { p_id: id });
  if (error) fehler(error, "Der Termin konnte nicht gelöscht werden.");
}

/**
 * Einen Tag (oder ab diesem Tag) aus einer Wiederholung nehmen – eigene
 * Termine und Einträge bei verbundenen Konten. Gibt true zurück, wenn damit
 * der ganze Termin weg ist.
 */
export async function terminAusnahme(id: string, datum: string, ab: boolean): Promise<boolean> {
  const { data, error } = await createClient().rpc("termin_ausnahme", { p_id: id, p_datum: datum, p_ab: ab });
  if (error) fehler(error, "Der Termin konnte nicht gelöscht werden.");
  return data === true;
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

// ---- Personen (mehrere Freigaben, Migration 0151) ---------------------------

export type PersonArt = "partner" | "familie" | "freunde" | "kollegen";

export const PERSON_ARTEN: { art: PersonArt; text: string; mehrzahl: string }[] = [
  { art: "partner", text: "Partner", mehrzahl: "Partner" },
  { art: "familie", text: "Familie", mehrzahl: "Familie" },
  { art: "freunde", text: "Freunde", mehrzahl: "Freunde" },
  { art: "kollegen", text: "Kollege", mehrzahl: "Kollegen" },
];

export interface Person {
  id: string;
  name: string;
  art: PersonArt;
  darfEintragen: boolean;
  termineSehen: boolean;
  linkAktiv: boolean;
  linkErstelltAm: string | null;
  zuletztGenutzt: string | null;
}

export async function fetchPersonen(): Promise<Person[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createClient().rpc("meine_personen");
  if (error) fehler(error, "Die Personen konnten nicht geladen werden.");
  return (
    (data ?? []) as {
      id: string;
      name: string;
      art: PersonArt;
      darf_eintragen: boolean;
      termine_sehen: boolean;
      link_aktiv: boolean;
      link_erstellt_am: string | null;
      zuletzt_genutzt: string | null;
    }[]
  ).map((z) => ({
    id: z.id,
    name: z.name,
    art: z.art,
    darfEintragen: z.darf_eintragen,
    termineSehen: z.termine_sehen,
    linkAktiv: z.link_aktiv,
    linkErstelltAm: z.link_erstellt_am,
    zuletztGenutzt: z.zuletzt_genutzt,
  }));
}

export interface PersonEingabe {
  name: string;
  art: PersonArt;
  darfEintragen: boolean;
  termineSehen: boolean;
}

/** Legt die Person an und liefert den Schlüssel für ihren Link. */
export async function personAnlegen(p: PersonEingabe): Promise<{ id: string; schluessel: string }> {
  const { data, error } = await createClient().rpc("person_anlegen", {
    p_name: p.name,
    p_art: p.art,
    p_darf_eintragen: p.darfEintragen,
    p_termine_sehen: p.termineSehen,
  });
  const z = data as { id?: string; schluessel?: string } | null;
  if (error || !z?.id || !z.schluessel) fehler(error, "Die Einladung konnte nicht erstellt werden.");
  return { id: z!.id!, schluessel: z!.schluessel! };
}

/**
 * Einladung mit eigenem Konto (Migration 0163): legt die Person mit ihren
 * Rechten an und liefert den Code für den Link /verbinden/CODE. Mit ihm legt
 * die Person ein Konto an und ist danach verbunden. 7 Tage, einmal nutzbar.
 */
export async function einladungErstellen(p: PersonEingabe): Promise<{ code: string; gueltigBis: string; person: string }> {
  const { data, error } = await createClient().rpc("einladung_erstellen", {
    p_name: p.name,
    p_art: p.art,
    p_darf_eintragen: p.darfEintragen,
    p_termine_sehen: p.termineSehen,
  });
  const z = data as { code?: string; gueltig_bis?: string; person?: string } | null;
  if (error || !z?.code || !z.person) fehler(error, "Die Einladung konnte nicht erstellt werden.");
  return { code: z!.code!, gueltigBis: z!.gueltig_bis ?? "", person: z!.person! };
}

/** Offene Einladungen: Person -> gültig bis. */
export async function fetchEinladungen(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  const { data, error } = await createClient().rpc("meine_einladungen");
  if (error) fehler(error, "Die Einladungen konnten nicht geladen werden.");
  const aus: Record<string, string> = {};
  for (const z of (data ?? []) as { person: string; bis: string }[]) aus[z.person] = z.bis;
  return aus;
}

export async function personAendern(id: string, p: PersonEingabe) {
  const { error } = await createClient().rpc("person_aendern", {
    p_id: id,
    p_name: p.name,
    p_art: p.art,
    p_darf_eintragen: p.darfEintragen,
    p_termine_sehen: p.termineSehen,
  });
  if (error) fehler(error, "Das konnte nicht gespeichert werden.");
}

/** Neuer Link – der alte gilt danach nicht mehr. */
export async function personLinkNeu(id: string): Promise<string> {
  const { data, error } = await createClient().rpc("person_link_neu", { p_id: id });
  if (error || typeof data !== "string") fehler(error, "Der Link konnte nicht erstellt werden.");
  return data as string;
}

export async function personLinkBeenden(id: string) {
  const { error } = await createClient().rpc("person_link_beenden", { p_id: id });
  if (error) fehler(error, "Der Link konnte nicht beendet werden.");
}

/** Entfernt die Person mit allen Tagen und Terminen, die sie eingetragen hat. */
export async function personEntfernen(id: string) {
  const { error } = await createClient().rpc("person_entfernen", { p_id: id });
  if (error) fehler(error, "Die Person konnte nicht entfernt werden.");
}

/** Tage aller eigenen Personen: Person -> Tag -> Kürzel. */
export async function fetchPersonenTage(von: string, bis: string): Promise<Record<string, Record<string, PartnerCode>>> {
  if (!isSupabaseConfigured) return {};
  const { data, error } = await createClient().rpc("meine_personen_tage", { p_von: von, p_bis: bis });
  if (error) fehler(error, "Die Einträge konnten nicht geladen werden.");
  const ergebnis: Record<string, Record<string, PartnerCode>> = {};
  for (const z of (data ?? []) as { person_id: string; tag: string; schicht: PartnerCode }[]) {
    (ergebnis[z.person_id] ??= {})[z.tag] = z.schicht;
  }
  return ergebnis;
}

export async function personTageSetzen(id: string, von: string, anzahl: number, code: PartnerCode | null) {
  const { error } = await createClient().rpc("person_tage_setzen", {
    p_id: id,
    p_von: von,
    p_anzahl: anzahl,
    p_schicht: code,
  });
  if (error) fehler(error, "Das konnte nicht gespeichert werden.");
}

// ---- Partner (ohne Anmeldung) ---------------------------------------------

export interface PartnerKalender {
  name: string;
  /** Name, unter dem die eingeladene Person angelegt ist. */
  gast: string;
  /** Darf eigene Tage und Termine eintragen (sonst nur ansehen). */
  darfEintragen: boolean;
  termineGeteilt: boolean;
  /** Farben des Inhabers für seine Schichten. */
  farben: FarbenCodes;
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
    gast?: string;
    darfEintragen?: boolean;
    termineGeteilt?: boolean;
    farben?: unknown;
    termine?: Termin[];
    tage: [string, PartnerCode | null, PartnerCode | null][];
  };
  const karte = new Map<string, [PartnerCode | null, PartnerCode | null]>();
  for (const [tag, eigen, partner] of roh?.tage ?? []) karte.set(tag, [eigen, partner]);
  return {
    name: roh?.name ?? "",
    gast: roh?.gast ?? "",
    // Ältere Antworten ohne das Feld: wie bisher eintragen lassen.
    darfEintragen: roh?.darfEintragen !== false,
    termineGeteilt: roh?.termineGeteilt === true,
    farben: farbenAus(roh?.farben),
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
