/**
 * Letzter Stand auf diesem Gerät – damit der Kalender beim Öffnen sofort die
 * eigenen Schichten zeigt und erst danach im Hintergrund auffrischt.
 *
 * Anders als der Zwischenspeicher (nur Arbeitsspeicher, weg beim Schließen)
 * bleibt das hier im lokalen Speicher des Browsers. Deshalb gilt:
 *   * nur eigene Daten (eigene Schichten, eigene Einträge, Feiertage) – nichts
 *     von anderen Personen, keine Anträge, keine Krankheitsgründe,
 *   * der Schlüssel enthält immer die Benutzer-Id,
 *   * alles verfällt nach 14 Tagen und wird beim Abmelden und auf der
 *     Anmeldeseite gelöscht (`leereZwischenspeicher` ruft `leereGeraet` auf),
 *   * nichts geht an einen Server.
 */

const PRAEFIX = "sp_geraet:";
const MAX_ALTER_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_EINTRAEGE = 40;

interface Eintrag {
  t: number;
  w: unknown;
}

const speicher = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function ausGeraet<T>(schluessel: string): T | undefined {
  const s = speicher();
  if (!s) return undefined;
  try {
    const roh = s.getItem(PRAEFIX + schluessel);
    if (!roh) return undefined;
    const e = JSON.parse(roh) as Eintrag;
    if (typeof e?.t !== "number" || Date.now() - e.t > MAX_ALTER_MS) {
      s.removeItem(PRAEFIX + schluessel);
      return undefined;
    }
    return e.w as T;
  } catch {
    return undefined;
  }
}

export function aufGeraet(schluessel: string, wert: unknown): void {
  const s = speicher();
  if (!s) return;
  try {
    s.setItem(PRAEFIX + schluessel, JSON.stringify({ t: Date.now(), w: wert } satisfies Eintrag));
    // Nicht endlos wachsen: die ältesten Einträge gehen zuerst.
    const alle: { k: string; t: number }[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (!k?.startsWith(PRAEFIX)) continue;
      try {
        alle.push({ k, t: (JSON.parse(s.getItem(k) ?? "{}") as Eintrag).t ?? 0 });
      } catch {
        alle.push({ k, t: 0 });
      }
    }
    if (alle.length > MAX_EINTRAEGE) {
      alle.sort((a, b) => a.t - b.t);
      for (const { k } of alle.slice(0, alle.length - MAX_EINTRAEGE)) s.removeItem(k);
    }
  } catch {
    // voll oder gesperrt – dann eben ohne
  }
}

export function leereGeraet(): void {
  const s = speicher();
  if (!s) return;
  try {
    const weg: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PRAEFIX)) weg.push(k);
    }
    for (const k of weg) s.removeItem(k);
  } catch {
    // egal
  }
}
