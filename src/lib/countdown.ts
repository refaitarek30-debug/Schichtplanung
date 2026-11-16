"use client";

import { useEffect, useState } from "react";

/**
 * Countdown: wie lange noch bis zu einer Schicht, einem Termin oder dem Urlaub.
 * Reine Rechnung; gemerkte Countdowns liegen nur auf diesem Gerät.
 */

const TAG_MS = 864e5;

/** Kalendertage von heute bis zu einem Tag ("YYYY-MM-DD"), 0 = heute. */
export function tageBis(iso: string, heute: string): number {
  return Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / TAG_MS);
}

/** „heute“, „morgen“, „noch 23 Tage“. */
export function nochTage(iso: string, heute: string): string | null {
  const n = tageBis(iso, heute);
  if (n < 0) return null;
  return n === 0 ? "heute" : n === 1 ? "morgen" : `noch ${n} Tage`;
}

export interface Rest {
  tage: number;
  std: number;
  min: number;
  /** Millisekunden bis zum Ziel; ≤ 0 = vorbei oder läuft. */
  ms: number;
}

export function restBis(ziel: Date, jetzt: Date): Rest {
  const ms = ziel.getTime() - jetzt.getTime();
  const m = Math.max(0, Math.floor(ms / 60000));
  return { tage: Math.floor(m / 1440), std: Math.floor((m % 1440) / 60), min: m % 60, ms };
}

/** Kurz: „23 Tage“, „3 T 2 Std“, „5 Std 12 Min“, „12 Min“. */
export function restText(r: Rest): string {
  if (r.ms <= 0) return "jetzt";
  if (r.tage >= 7) return `${r.tage} Tage`;
  if (r.tage >= 1) return r.std ? `${r.tage} T ${r.std} Std` : `${r.tage} ${r.tage === 1 ? "Tag" : "Tage"}`;
  if (r.std >= 1) return `${r.std} Std ${String(r.min).padStart(2, "0")}`;
  return `${r.min} Min`;
}

/** Datum + Uhrzeit (lokal) als Zeitpunkt. */
export function zeitpunkt(iso: string, uhr = "00:00"): Date {
  const [j, mo, t] = iso.split("-").map(Number);
  const [h, mi] = uhr.split(":").map(Number);
  return new Date(j!, (mo ?? 1) - 1, t ?? 1, h ?? 0, mi ?? 0);
}

/** Die aktuelle Zeit, die sich regelmäßig selbst erneuert (Standard: jede halbe Minute). */
export function useJetzt(ms = 30_000): Date {
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setJetzt(new Date()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return jetzt;
}

// ---- Gemerkte Countdowns (nur auf diesem Gerät) -----------------------------

export interface EigenerCountdown {
  id: string;
  titel: string;
  /** "YYYY-MM-DD" */
  datum: string;
  /** "HH:MM" oder leer = ganzer Tag */
  zeit: string;
  emoji: string;
}

export interface CountdownSpeicher {
  /** Ids gemerkter Termine */
  termine: string[];
  eigene: EigenerCountdown[];
  /** Fotos je Eintrag (Schlüssel wie „e-…“, „t-…“, „u-…“), verkleinert als JPEG-Daten-URL. */
  bilder: Record<string, string>;
}

const BILD_MAX = 250_000;
const istBild = (x: unknown): x is string => typeof x === "string" && x.startsWith("data:image/jpeg;base64,") && x.length <= BILD_MAX;

/** Foto auf höchstens 720 px verkleinern, als JPEG – bleibt nur auf diesem Gerät. */
export async function bildVerkleinern(datei: File, max = 720): Promise<string> {
  const url = URL.createObjectURL(datei);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * f));
    c.height = Math.max(1, Math.round(img.naturalHeight * f));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.78, 0.65, 0.5, 0.35]) {
      const d = c.toDataURL("image/jpeg", q);
      if (d.length <= BILD_MAX) return d;
    }
    throw new Error("zu groß");
  } finally {
    URL.revokeObjectURL(url);
  }
}

const SCHLUESSEL = "sp_countdown";
const EREIGNIS = "sp-countdown-geaendert";

export function ladeCountdowns(): CountdownSpeicher {
  try {
    const roh = JSON.parse(window.localStorage.getItem(SCHLUESSEL) ?? "null") as Partial<CountdownSpeicher> | null;
    const termine = Array.isArray(roh?.termine) ? roh.termine.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
    const eigene = Array.isArray(roh?.eigene)
      ? roh.eigene
          .filter((e): e is EigenerCountdown => !!e && typeof e.id === "string" && typeof e.titel === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.datum ?? ""))
          .map((e) => ({ ...e, titel: e.titel.slice(0, 60), zeit: /^\d{2}:\d{2}$/.test(e.zeit ?? "") ? e.zeit : "", emoji: (e.emoji ?? "⏳").slice(0, 4) }))
          .slice(0, 30)
      : [];
    const bilder: Record<string, string> = {};
    if (roh?.bilder && typeof roh.bilder === "object") {
      for (const [k, v] of Object.entries(roh.bilder).slice(0, 30)) if (istBild(v)) bilder[k] = v;
    }
    return { termine, eigene, bilder };
  } catch {
    return { termine: [], eigene: [], bilder: {} };
  }
}

/** false = Speicher voll oder gesperrt. */
export function speichereCountdowns(c: CountdownSpeicher): boolean {
  try {
    window.localStorage.setItem(SCHLUESSEL, JSON.stringify(c));
    window.dispatchEvent(new Event(EREIGNIS));
    return true;
  } catch {
    return false;
  }
}

export function useCountdowns() {
  const [c, setC] = useState<CountdownSpeicher>({ termine: [], eigene: [], bilder: {} });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setC(ladeCountdowns());
    const neu = () => setC(ladeCountdowns());
    window.addEventListener(EREIGNIS, neu);
    return () => window.removeEventListener(EREIGNIS, neu);
  }, []);
  const setze = (f: (alt: CountdownSpeicher) => CountdownSpeicher): boolean => speichereCountdowns(f(ladeCountdowns()));
  return { countdowns: c, setze };
}
