/**
 * Baut aus den Tagen des Plans eine Kalenderdatei (ICS) zum Abonnieren.
 * Schichten sind Termine mit Uhrzeit (Europe/Berlin), Urlaub, Schulung und
 * Abwesenheit ganztägige Termine. Freie Tage erzeugen nichts.
 */

export type AboArt = "schicht" | "urlaub" | "schulung" | "abwesend";

export interface AboTag {
  tag: string; // YYYY-MM-DD
  art: AboArt;
  name: string | null;
  von: string | null; // HH:MM
  bis: string | null; // HH:MM
}

const ART_TITEL: Record<Exclude<AboArt, "schicht">, string> = {
  urlaub: "Urlaub",
  schulung: "Schulung",
  abwesend: "Abwesend",
};

const ZEITZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
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

export function baueIcs(tage: AboTag[], jetzt: Date = new Date()): string {
  const zeilen: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Schichtplan//Kalender-Abo//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Schichtplan",
    "X-WR-TIMEZONE:Europe/Berlin",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...ZEITZONE,
  ];
  const stempel = zeitStempel(jetzt);
  const gesehen = new Set<string>();

  for (const t of tage) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.tag)) continue;
    const uid = `${t.tag}-${t.art}@schichtplan`;
    if (gesehen.has(uid)) continue;
    gesehen.add(uid);

    const ev: string[] = ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stempel}`];
    const zeit = /^\d{2}:\d{2}$/;
    if (t.art === "schicht" && t.von && t.bis && zeit.test(t.von) && zeit.test(t.bis)) {
      const endTag = t.bis <= t.von ? plusTage(t.tag, 1) : t.tag;
      ev.push(
        `DTSTART;TZID=Europe/Berlin:${ohneStriche(t.tag)}T${t.von.replace(":", "")}00`,
        `DTEND;TZID=Europe/Berlin:${ohneStriche(endTag)}T${t.bis.replace(":", "")}00`,
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
    ev.push("END:VEVENT");
    zeilen.push(...ev);
  }

  zeilen.push("END:VCALENDAR");
  return zeilen.map(falteZeile).join("\r\n") + "\r\n";
}
