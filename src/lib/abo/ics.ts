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

export type AboArt = "schicht" | "urlaub" | "schulung" | "abwesend";

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
export type AboTeil = "alles" | "frueh" | "spaet" | "nacht" | "frei";

export const ABO_TEILE: Record<AboTeil, { datei: string; name: string; farbe: string; css: string }> = {
  alles: { datei: "plan.ics", name: "Schichtplan", farbe: "#2F5BEA", css: "royalblue" },
  frueh: { datei: "frueh.ics", name: "Frühschicht", farbe: "#F59E0B", css: "orange" },
  spaet: { datei: "spaet.ics", name: "Spätschicht", farbe: "#16A34A", css: "green" },
  nacht: { datei: "nacht.ics", name: "Nachtschicht", farbe: "#2563EB", css: "blue" },
  frei: { datei: "urlaub.ics", name: "Urlaub & Abwesenheit", farbe: "#9333EA", css: "purple" },
};

export function teilAusDatei(datei: string): AboTeil | null {
  for (const [teil, t] of Object.entries(ABO_TEILE)) if (t.datei === datei) return teil as AboTeil;
  return null;
}

const ART_TITEL: Record<Exclude<AboArt, "schicht">, string> = {
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

function teilVon(t: AboTag): Exclude<AboTeil, "alles"> {
  return t.art === "schicht" ? schichtTeil(t) : "frei";
}

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

export function baueIcs(tage: AboTag[], teil: AboTeil = "alles", jetzt: Date = new Date()): string {
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
  const gesehen = new Set<string>();
  const zeit = /^\d{2}:\d{2}$/;

  for (const t of tage) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.tag)) continue;
    const eigenerTeil = teilVon(t);
    if (teil !== "alles" && teil !== eigenerTeil) continue;
    const uid = `${t.tag}-${t.art}${teil === "alles" ? "" : `-${teil}`}@schichtplan`;
    if (gesehen.has(uid)) continue;
    gesehen.add(uid);

    const ev: string[] = ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stempel}`];
    if (t.art === "schicht" && t.von && t.bis && zeit.test(t.von) && zeit.test(t.bis)) {
      const endTag = t.bis <= t.von ? plusTage(t.tag, 1) : t.tag;
      ev.push(
        `DTSTART:${ohneStriche(t.tag)}T${t.von.replace(":", "")}00`,
        `DTEND:${ohneStriche(endTag)}T${t.bis.replace(":", "")}00`,
        `SUMMARY:${icsText(t.name || "Schicht")}`,
        "TRANSP:OPAQUE",
      );
    } else {
      const titel = t.art === "schicht" ? t.name || "Schicht" : ART_TITEL[t.art];
      ev.push(
        `DTSTART;VALUE=DATE:${ohneStriche(t.tag)}`,
        `DTEND;VALUE=DATE:${ohneStriche(plusTage(t.tag, 1))}`,
        `SUMMARY:${icsText(titel)}`,
        "TRANSP:TRANSPARENT",
      );
    }
    ev.push(`COLOR:${ABO_TEILE[eigenerTeil].css}`, "END:VEVENT");
    zeilen.push(...ev);
  }

  zeilen.push("END:VCALENDAR");
  return zeilen.map(falteZeile).join("\r\n") + "\r\n";
}
