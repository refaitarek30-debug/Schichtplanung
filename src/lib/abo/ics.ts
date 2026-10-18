/**
 * Baut aus den Tagen des Plans eine Kalenderdatei (ICS) zum Abonnieren.
 * Schichten sind Termine mit Uhrzeit, Urlaub, Schulung und Abwesenheit
 * ganztägige Termine. Freie Tage erzeugen nichts.
 *
 * Uhrzeiten sind bewusst „schwebend“ (ohne Zeitzone): Die Spätschicht steht
 * immer als 14–22 Uhr im Kalender, auch wenn das Handy gerade auf einer
 * anderen Zeitzone steht (Urlaub im Ausland). Mit Zeitzone hätte das iPhone
 * sie z. B. in Thailand als 19–3 Uhr angezeigt.
 */

export type AboArt = "schicht" | "urlaub" | "schulung" | "abwesend" | "eigen";

export interface AboTag {
  tag: string; // YYYY-MM-DD
  art: AboArt;
  name: string | null;
  von: string | null; // HH:MM
  bis: string | null; // HH:MM
}

/**
 * Teilkalender. Auf dem iPhone hat jeder Kalender genau eine Farbe – wer
 * Früh, Spät und Nacht farbig getrennt sehen will, abonniert sie einzeln.
 */
export type AboTeil = "alles" | "frueh" | "spaet" | "nacht" | "frei" | "termine";

/** Eigener Termin aus „Mein Kalender“ (abo_termine, Migration 0145). */
export interface AboTermin {
  id: string;
  datum: string; // YYYY-MM-DD
  /** Letzter Tag eines mehrtägigen ganztägigen Termins (Migration 0154). */
  bis?: string | null;
  titel: string;
  ganztaegig: boolean;
  beginn: string | null; // HH:MM
  ende: string | null; // HH:MM
  wiederholung: "nie" | "taeglich" | "woechentlich" | "monatlich" | "jaehrlich";
  notiz: string;
  ort: string;
  /** Tage, an denen ein wiederholender Termin ausfällt (Migration 0161). */
  ausfaelle?: string[] | null;
  /** Ab diesem Tag gibt es keine Wiederholungen mehr (Migration 0161). */
  serie_ab?: string | null;
}

export const ABO_TEILE: Record<AboTeil, { datei: string; name: string; farbe: string; css: string }> = {
  alles: { datei: "plan.ics", name: "Schichtplan", farbe: "#2F5BEA", css: "royalblue" },
  frueh: { datei: "frueh.ics", name: "Frühschicht", farbe: "#F59E0B", css: "orange" },
  spaet: { datei: "spaet.ics", name: "Spätschicht", farbe: "#16A34A", css: "green" },
  nacht: { datei: "nacht.ics", name: "Nachtschicht", farbe: "#2563EB", css: "blue" },
  frei: { datei: "urlaub.ics", name: "Urlaub & Abwesenheit", farbe: "#9333EA", css: "purple" },
  termine: { datei: "termine.ics", name: "Meine Termine", farbe: "#0D9488", css: "teal" },
};

const RRULE: Record<AboTermin["wiederholung"], string | null> = {
  nie: null,
  taeglich: "FREQ=DAILY",
  woechentlich: "FREQ=WEEKLY",
  monatlich: "FREQ=MONTHLY",
  jaehrlich: "FREQ=YEARLY",
};

export function teilAusDatei(datei: string): AboTeil | null {
  for (const [teil, t] of Object.entries(ABO_TEILE)) if (t.datei === datei) return teil as AboTeil;
  return null;
}

const ART_TITEL: Record<Exclude<AboArt, "schicht" | "eigen">, string> = {
  urlaub: "Urlaub",
  schulung: "Schulung",
  abwesend: "Abwesend",
};

/** Früh, Spät oder Nacht – nach dem Namen, sonst nach der Anfangszeit. */
export function schichtTeil(t: Pick<AboTag, "name" | "von">): "frueh" | "spaet" | "nacht" {
  const n = (t.name ?? "").toLowerCase();
  if (n.includes("früh") || n.includes("frueh")) return "frueh";
  if (n.includes("spät") || n.includes("spaet")) return "spaet";
  if (n.includes("nacht")) return "nacht";
  const stunde = Number.parseInt(t.von ?? "", 10);
  if (Number.isNaN(stunde)) return "frueh";
  if (stunde >= 4 && stunde < 11) return "frueh";
  if (stunde >= 11 && stunde < 19) return "spaet";
  return "nacht";
}

function teilVon(t: AboTag): Exclude<AboTeil, "alles" | "termine"> {
  return t.art === "schicht" ? schichtTeil(t) : "frei";
}

/** Eigene Einträge („Nebenjob“, „Sport“) gibt es nur im Gesamtkalender. */
const nurGesamt = (t: AboTag) => t.art === "eigen";

export function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Zeilen höchstens 75 Byte lang; Fortsetzung mit Leerzeichen (RFC 5545). */
export function falteZeile(zeile: string): string {
  const enc = new TextEncoder();
  if (enc.encode(zeile).length <= 75) return zeile;
  const teile: string[] = [];
  let aktuell = "";
  let bytes = 0;
  let grenze = 75;
  for (const zeichen of zeile) {
    const b = enc.encode(zeichen).length;
    if (bytes + b > grenze) {
      teile.push(aktuell);
      aktuell = "";
      bytes = 0;
      grenze = 74; // das führende Leerzeichen zählt mit
    }
    aktuell += zeichen;
    bytes += b;
  }
  teile.push(aktuell);
  return teile.join("\r\n ");
}

const ohneStriche = (d: string) => d.replace(/-/g, "");

function plusTage(tag: string, n: number): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function zeitStempel(jetzt: Date): string {
  return jetzt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function plusStunde(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function terminZeilen(t: AboTermin, stempel: string): string[] {
  const zeit = /^\d{2}:\d{2}$/;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.datum)) return [];
  const ev = ["BEGIN:VEVENT", `UID:termin-${t.id}@schichtplan`, `DTSTAMP:${stempel}`];
  if (!t.ganztaegig && t.beginn && zeit.test(t.beginn)) {
    const ende = t.ende && zeit.test(t.ende) ? t.ende : plusStunde(t.beginn);
    const endTag = ende <= t.beginn ? plusTage(t.datum, 1) : t.datum;
    ev.push(
      `DTSTART:${ohneStriche(t.datum)}T${t.beginn.replace(":", "")}00`,
      `DTEND:${ohneStriche(endTag)}T${ende.replace(":", "")}00`,
    );
  } else {
    const letzter = t.bis && /^\d{4}-\d{2}-\d{2}$/.test(t.bis) && t.bis > t.datum ? t.bis : t.datum;
    ev.push(`DTSTART;VALUE=DATE:${ohneStriche(t.datum)}`, `DTEND;VALUE=DATE:${ohneStriche(plusTage(letzter, 1))}`);
  }
  const regel = RRULE[t.wiederholung];
  if (regel) {
    const tag = /^\d{4}-\d{2}-\d{2}$/;
    const mitZeit = !t.ganztaegig && !!t.beginn && zeit.test(t.beginn);
    const bis = t.serie_ab && tag.test(t.serie_ab) ? plusTage(t.serie_ab, -1) : null;
    const ende = bis ? `;UNTIL=${ohneStriche(bis)}${mitZeit ? "T235959" : ""}` : "";
    ev.push(`RRULE:${regel}${ende}`);
    const ausfaelle = (t.ausfaelle ?? []).filter((d) => tag.test(d));
    if (ausfaelle.length) {
      ev.push(
        mitZeit
          ? `EXDATE:${ausfaelle.map((d) => `${ohneStriche(d)}T${t.beginn!.replace(":", "")}00`).join(",")}`
          : `EXDATE;VALUE=DATE:${ausfaelle.map(ohneStriche).join(",")}`,
      );
    }
  }
  ev.push(`SUMMARY:${icsText(t.titel || "Termin")}`);
  if (t.ort) ev.push(`LOCATION:${icsText(t.ort)}`);
  if (t.notiz) ev.push(`DESCRIPTION:${icsText(t.notiz)}`);
  ev.push(`COLOR:${ABO_TEILE.termine.css}`, "END:VEVENT");
  return ev;
}

export function baueIcs(
  tage: AboTag[],
  teil: AboTeil = "alles",
  jetzt: Date = new Date(),
  termine: AboTermin[] = [],
): string {
  const kopf = ABO_TEILE[teil];
  const zeilen: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Schichtplan//Kalender-Abo//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(kopf.name)}`,
    `NAME:${icsText(kopf.name)}`,
    `X-APPLE-CALENDAR-COLOR:${kopf.farbe}`,
    `COLOR:${kopf.css}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  const stempel = zeitStempel(jetzt);
  const gleich = new Set<string>();
  const zaehler = new Map<string, number>();
  const zeit = /^\d{2}:\d{2}$/;

  for (const t of tage) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.tag)) continue;
    const eigenerTeil = teilVon(t);
    if (nurGesamt(t) ? teil !== "alles" : teil !== "alles" && teil !== eigenerTeil) continue;
    // Genau dieselbe Zeile zweimal (überlappende Abfragen): nur einmal.
    const inhalt = [t.tag, t.art, t.name, t.von, t.bis].join("|");
    if (gleich.has(inhalt)) continue;
    gleich.add(inhalt);
    // Mehrere Einträge am selben Tag (z. B. zwei Schichten) brauchen je eine eigene Kennung.
    const basis = `${t.tag}-${t.art}${teil === "alles" ? "" : `-${teil}`}`;
    const n = (zaehler.get(basis) ?? 0) + 1;
    zaehler.set(basis, n);
    const uid = `${n === 1 ? basis : `${basis}-${n}`}@schichtplan`;

    const ev: string[] = ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stempel}`];
    if ((t.art === "schicht" || t.art === "eigen") && t.von && t.bis && zeit.test(t.von) && zeit.test(t.bis)) {
      const endTag = t.bis <= t.von ? plusTage(t.tag, 1) : t.tag;
      ev.push(
        `DTSTART:${ohneStriche(t.tag)}T${t.von.replace(":", "")}00`,
        `DTEND:${ohneStriche(endTag)}T${t.bis.replace(":", "")}00`,
        `SUMMARY:${icsText(t.name || "Schicht")}`,
        "TRANSP:OPAQUE",
      );
    } else {
      const titel = t.art === "schicht" || t.art === "eigen" ? t.name || (t.art === "eigen" ? "Eintrag" : "Schicht") : ART_TITEL[t.art];
      ev.push(
        `DTSTART;VALUE=DATE:${ohneStriche(t.tag)}`,
        `DTEND;VALUE=DATE:${ohneStriche(plusTage(t.tag, 1))}`,
        `SUMMARY:${icsText(titel)}`,
        "TRANSP:TRANSPARENT",
      );
    }
    ev.push(`COLOR:${t.art === "eigen" ? ABO_TEILE.termine.css : ABO_TEILE[eigenerTeil].css}`, "END:VEVENT");
    zeilen.push(...ev);
  }

  if (teil === "alles" || teil === "termine") {
    for (const t of termine) zeilen.push(...terminZeilen(t, stempel));
  }

  zeilen.push("END:VCALENDAR");
  return zeilen.map(falteZeile).join("\r\n") + "\r\n";
}
