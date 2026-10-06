import { formatDE } from "@/lib/dates";
import { leaveKindLabels, type LeaveKind } from "@/lib/types";
import type { ProtokollEintrag } from "@/lib/data/protokoll";

/**
 * Wie ein Protokolleintrag auf der Seite erscheint: als Satz, der hinter
 * dem Namen der handelnden Person steht („Tarek Refai – hat … genehmigt“).
 */
export type ProtokollKategorie = "anmeldung" | "fehlanmeldung" | "aenderung" | "fehler";

export interface ProtokollZeile {
  kategorie: ProtokollKategorie;
  text: string;
  /** Kleinere Zusatzzeile, z. B. Seite oder Gerät. */
  zusatz: string | null;
}

const ABWESENHEIT: Record<string, string> = {
  schulung: "Schulung",
  sonstiges: "Sonstige Abwesenheit",
  urlaub: "Urlaub",
  sonderurlaub: "Sonderurlaub",
  altersfreizeit: "Altersfreizeit",
  bildungsurlaub: "Bildungsurlaub",
};

const KONTOFELD: Record<string, string> = {
  entitlement: "Urlaubsanspruch",
  carried_over: "Resturlaub Vorjahr",
  v_entitlement: "V-Tage",
  v_carried_over: "V-Tage Vorjahr",
};

function text(wert: unknown): string | null {
  if (wert === null || wert === undefined || wert === "") return null;
  return String(wert);
}

function datum(wert: unknown): string {
  const iso = text(wert);
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? "?";
  return formatDE(iso.slice(0, 10));
}

function zeitraum(von: unknown, bis: unknown): string {
  const a = datum(von);
  const b = datum(bis);
  return a === b ? `am ${a}` : `${a} – ${b}`;
}

function art(wert: unknown): string {
  const k = text(wert);
  if (!k) return "Urlaub";
  return leaveKindLabels[k as LeaveKind] ?? k;
}

function fuer(e: ProtokollEintrag): string {
  return e.betroffen ? ` für ${e.betroffen}` : "";
}

function von(e: ProtokollEintrag): string {
  return e.betroffen ? ` von ${e.betroffen}` : "";
}

function zahl(wert: unknown): string {
  const n = Number(wert);
  return Number.isFinite(n) ? n.toLocaleString("de-DE", { maximumFractionDigits: 2 }) : "?";
}

/** Eintrag in einen lesbaren Satz übersetzen. Unbekannte Aktionen bleiben sichtbar. */
export function beschreibe(e: ProtokollEintrag): ProtokollZeile {
  const d = e.details ?? {};
  const aenderung = (t: string, zusatz: string | null = null): ProtokollZeile => ({
    kategorie: "aenderung",
    text: t,
    zusatz,
  });

  switch (e.aktion) {
    // --- Anmeldung -------------------------------------------------------
    case "anmeldung":
      return { kategorie: "anmeldung", text: "hat sich angemeldet", zusatz: text(d.text) };
    case "anmeldung.fehlgeschlagen":
      return {
        kategorie: "fehlanmeldung",
        text: `Anmeldung fehlgeschlagen (falsches Passwort) für ${text(d.email) ?? "?"}`,
        zusatz: null,
      };
    case "abmeldung":
      return { kategorie: "anmeldung", text: "hat sich abgemeldet", zusatz: null };
    case "abmeldung.inaktiv":
      return {
        kategorie: "anmeldung",
        text: "wurde nach 10 Minuten ohne Aktivität automatisch abgemeldet",
        zusatz: text(d.seite),
      };

    // --- Fehler ----------------------------------------------------------
    case "fehler.anzeige":
      return {
        kategorie: "fehler",
        text: `bekam die Meldung „${text(d.text) ?? "?"}“`,
        zusatz: text(d.seite) ? `Seite ${d.seite}` : null,
      };
    case "fehler.absturz":
      return {
        kategorie: "fehler",
        text: `Technischer Fehler im Browser: ${text(d.text) ?? "unbekannt"}`,
        zusatz: text(d.seite) ? `Seite ${d.seite}` : null,
      };

    // --- Urlaub und Anträge ---------------------------------------------
    case "urlaub.beantragt":
      return aenderung(`hat ${art(d.art)}${fuer(e)} beantragt: ${zeitraum(d.von, d.bis)}`);
    case "urlaub.eingetragen":
      return aenderung(`hat ${art(d.art)}${fuer(e)} direkt eingetragen: ${zeitraum(d.von, d.bis)}`);
    case "urlaub.geaendert":
      return aenderung(
        `hat ${art(d.art)}${von(e)} verschoben: ${zeitraum(d.von_vorher, d.bis_vorher)} → ${zeitraum(d.von, d.bis)}`,
      );
    case "urlaub.geloescht":
      return aenderung(`hat ${art(d.art)}${von(e)} gelöscht: ${zeitraum(d.von, d.bis)}`);
    case "leave.approved":
      return aenderung(`hat ${art(d.kind)}${von(e)} genehmigt: ${zeitraum(d.von, d.bis)}`);
    case "leave.rejected":
      return aenderung(
        `hat ${art(d.kind)}${von(e)} abgelehnt: ${zeitraum(d.von, d.bis)}`,
        text(d.reason) ? `Begründung: ${d.reason}` : null,
      );
    case "leave.withdrawn":
      return aenderung(
        `hat ${d.selbst ? "den eigenen Antrag" : `den Antrag${von(e)}`} zurückgenommen: ${zeitraum(d.von, d.bis)}`,
        text(d.grund) ? `Grund: ${d.grund}` : null,
      );

    // --- Abwesenheiten und Plan -----------------------------------------
    case "absence.created":
      return aenderung(
        `hat ${ABWESENHEIT[text(d.art) ?? ""] ?? "eine Abwesenheit"}${fuer(e)} eingetragen${d.tag ? ` am ${datum(d.tag)}` : ""}`,
      );
    case "absence.updated":
      return aenderung(`hat eine Abwesenheit${von(e)} geändert${d.tag ? ` am ${datum(d.tag)}` : ""}`);
    case "absence.deleted":
      return aenderung(
        `hat ${ABWESENHEIT[text(d.art) ?? ""] ?? "eine Abwesenheit"}${von(e)} entfernt${d.tag ? ` am ${datum(d.tag)}` : ""}`,
      );
    case "plan.schicht":
      return aenderung(
        `hat ${e.betroffen ?? "eine Person"} am ${datum(d.tag)} auf ${text(d.schicht) ?? "?"} gesetzt`,
        text(d.vorher) ? `vorher: ${d.vorher}` : null,
      );
    case "plan.schicht_entfernt":
      return aenderung(
        `hat den Schichtwechsel${von(e)} am ${datum(d.tag)} zurückgenommen`,
        text(d.schicht) ? `war: ${d.schicht}` : null,
      );
    case "kommentar.geschrieben":
      return aenderung(`hat einen Kommentar${fuer(e)} am ${datum(d.tag)} geschrieben`);
    case "kommentar.geloescht":
      return aenderung(`hat einen Kommentar${von(e)} am ${datum(d.tag)} gelöscht`);
    case "fehlzeit.gespeichert":
      return aenderung(`hat eine Fehlzeit${fuer(e)} am ${datum(d.tag)} erfasst (${zahl(d.stunden)} Std.)`);
    case "fehlzeit.geloescht":
      return aenderung(`hat eine Fehlzeit${von(e)} am ${datum(d.tag)} gelöscht`);

    // --- Konten ----------------------------------------------------------
    case "konto.geaendert": {
      const felder = (d.felder ?? {}) as Record<string, [unknown, unknown]>;
      const liste = Object.entries(felder)
        .map(([feld, [alt, neu]]) => `${KONTOFELD[feld] ?? feld} ${zahl(alt)} → ${zahl(neu)}`)
        .join(", ");
      return aenderung(`hat das Konto ${text(d.jahr) ?? ""}${von(e)} geändert`, liste || null);
    }
    case "v_tage.gebucht":
      return aenderung(
        `hat ${zahl(d.tage)} V-Tage${fuer(e)} gebucht (${text(d.jahr) ?? ""})`,
        text(d.grund) ? `Grund: ${d.grund}` : null,
      );
    case "stundenkonto.af":
    case "stundenkonto.v":
    case "stundenkonto.af_v":
    case "stundenkonto.v.stillgelegt":
      return aenderung(`hat das Stundenkonto (AF/V)${von(e)} geändert`, text(d.hinweis) ?? text(d.grund));
    case "age_leave.changed":
    case "age_leave.confirmed":
    case "age_leave.freischaltung":
    case "age_leave.stand":
      return aenderung(`hat die Altersfreizeit${von(e)} geändert`);
    case "leave_balance.excel_abgleich":
      return aenderung(`hat das Konto${von(e)} mit der Excel-Liste abgeglichen`, text(d.grund));

    // --- Mitarbeiter -----------------------------------------------------
    case "employee.created":
      return aenderung(`hat ${e.betroffen ?? "eine Person"} angelegt`);
    case "employee.updated":
      return aenderung(`hat die Stammdaten${von(e)} geändert`);
    case "employee.deactivated":
      return aenderung(`hat ${e.betroffen ?? "eine Person"} deaktiviert`);
    case "employee.reactivated":
      return aenderung(`hat ${e.betroffen ?? "eine Person"} wieder aktiviert`);
    case "employee.deleted":
      return aenderung("hat eine Person vollständig gelöscht");
    case "role.changed":
      return aenderung(`hat die Rolle${von(e)} geändert`);
    case "personal_details.birth_date":
      return aenderung(`hat das Geburtsdatum${von(e)} geändert`);
    case "privacy.settings.changed":
      return aenderung("hat die eigenen Datenschutz-Einstellungen geändert");
    case "datenschutz.gruende_fuer_kollegen":
      return aenderung(
        `hat die Freigabe von Abwesenheitsgründen für Kollegen ${d.erlaubt ? "eingeschaltet" : "ausgeschaltet"}`,
      );

    // --- Firma und Regeln -------------------------------------------------
    case "mitteilung.erstellt":
      return aenderung(`hat die Mitteilung „${text(d.titel) ?? "?"}“ veröffentlicht`);
    case "mitteilung.geaendert":
      return aenderung(
        `hat die Mitteilung „${text(d.titel) ?? "?"}“ ${d.aktiv === false ? "ausgeblendet" : "geändert"}`,
      );
    case "mitteilung.geloescht":
      return aenderung(`hat die Mitteilung „${text(d.titel) ?? "?"}“ gelöscht`);
    case "sperre.erstellt":
      return aenderung(`hat eine Urlaubssperre angelegt: ${zeitraum(d.von, d.bis)}`, text(d.grund));
    case "sperre.geaendert":
      return aenderung(
        `hat eine Urlaubssperre ${d.aktiv === false ? "aufgehoben" : "geändert"}: ${zeitraum(d.von, d.bis)}`,
        text(d.grund),
      );
    case "sperre.geloescht":
      return aenderung(`hat eine Urlaubssperre gelöscht: ${zeitraum(d.von, d.bis)}`, text(d.grund));
    case "regel.geaendert":
      return aenderung(`hat eine Planungsregel geändert (${text(d.regel) ?? "?"})`);
    case "shift.staffing_changed":
      return aenderung(
        "hat die Besetzung einer Schicht geändert",
        `Soll ${zahl(d.soll_vorher)} → ${zahl(d.soll_nachher)}, Mindest ${zahl(d.mindest_vorher)} → ${zahl(d.mindest_nachher)}`,
      );
    case "plan.excel_abgleich":
      return aenderung("hat den Plan mit der Excel-Datei abgeglichen", text(d.datei));

    default:
      return aenderung(e.aktion);
  }
}
