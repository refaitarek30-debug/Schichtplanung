"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  fetchVorlieben,
  LEERE_VORLIEBEN,
  vorliebenSetzen,
  type Rolle,
  type Vorlage,
  type Vorlieben,
} from "@/lib/data/todos";
import { Blatt } from "@/components/privat/blatt";
import { cn } from "@/lib/utils";

/**
 * Vorschläge für Termine und To-dos – je nachdem, wofür man den Kalender
 * nutzt (Schule, Studium, Job, Schicht, Eltern). Feste Listen, keine KI.
 */

export const ROLLEN: { id: Rolle; icon: string; name: string; beispiel: string }[] = [
  { id: "schule", icon: "🎒", name: "Schule", beispiel: "Arbeiten, Training" },
  { id: "studium", icon: "🎓", name: "Studium", beispiel: "Vorlesung, Klausur" },
  { id: "job", icon: "💼", name: "Angestellt", beispiel: "Meeting, Call" },
  { id: "schicht", icon: "🏭", name: "Schichtarbeit", beispiel: "Früh, Spät, Nacht" },
  { id: "eltern", icon: "👨‍👩‍👧", name: "Eltern", beispiel: "Kita, Kinderarzt" },
  { id: "anders", icon: "✨", name: "Etwas anderes", beispiel: "Ich mach mein Ding" },
];

/** Kurzer Name für die Leiste im Termin-Formular. */
export const ROLLE_KURZ: Record<Rolle, string> = {
  schule: "🎒 Schule",
  studium: "🎓 Studium",
  job: "💼 Job",
  schicht: "🏭 Schicht",
  eltern: "👨‍👩‍👧 Eltern",
  anders: "✨ Alltag",
};

/** Je Rolle fünf Termine: Symbol, Name, Dauer in Minuten (0 = ganztägig). */
export const TERMIN_VORSCHLAEGE: Record<Rolle, Vorlage[]> = {
  schule: [
    { icon: "📝", titel: "Klassenarbeit", min: 60 },
    { icon: "📚", titel: "Hausaufgaben", min: 60 },
    { icon: "⚽", titel: "Training", min: 90 },
    { icon: "🎹", titel: "Musikschule", min: 45 },
    { icon: "👩‍🏫", titel: "Nachhilfe", min: 60 },
  ],
  studium: [
    { icon: "📖", titel: "Vorlesung", min: 90 },
    { icon: "📝", titel: "Klausur", min: 120 },
    { icon: "👥", titel: "Lerngruppe", min: 120 },
    { icon: "💼", titel: "Nebenjob", min: 240 },
    { icon: "📄", titel: "Abgabe", min: 0 },
  ],
  job: [
    { icon: "🤝", titel: "Meeting", min: 60 },
    { icon: "📞", titel: "Call", min: 30 },
    { icon: "✈️", titel: "Dienstreise", min: 0 },
    { icon: "🍽️", titel: "Mittagessen", min: 60 },
    { icon: "🩺", titel: "Arzttermin", min: 60 },
  ],
  schicht: [
    { icon: "🔁", titel: "Schicht tauschen", min: 0 },
    { icon: "🩺", titel: "Arzttermin", min: 60 },
    { icon: "😴", titel: "Ausschlafen", min: 0 },
    { icon: "🏋️", titel: "Sport", min: 60 },
    { icon: "👨‍👩‍👧", titel: "Familienzeit", min: 120 },
  ],
  eltern: [
    { icon: "🧸", titel: "Kita abholen", min: 30 },
    { icon: "🩺", titel: "Kinderarzt", min: 60 },
    { icon: "🎂", titel: "Kindergeburtstag", min: 180 },
    { icon: "🏫", titel: "Elternabend", min: 90 },
    { icon: "🏊", titel: "Schwimmkurs", min: 45 },
  ],
  anders: [
    { icon: "🎉", titel: "Treffen", min: 120 },
    { icon: "🩺", titel: "Arzttermin", min: 60 },
    { icon: "🏋️", titel: "Sport", min: 60 },
    { icon: "🎂", titel: "Geburtstag", min: 0 },
    { icon: "✈️", titel: "Reise", min: 0 },
  ],
};

/** Je Rolle fünf To-dos. */
export const TODO_VORSCHLAEGE: Record<Rolle, string[]> = {
  schule: ["📚 Hausaufgaben", "🎒 Tasche packen", "✍️ Für den Test lernen", "📝 Referat vorbereiten", "🧾 Zettel unterschreiben lassen"],
  studium: ["📖 Skript lesen", "📝 Hausarbeit schreiben", "📚 Bücher zurückgeben", "💶 Semesterbeitrag zahlen", "🗂️ Zur Prüfung anmelden"],
  job: ["📧 Mails beantworten", "🧾 Reisekosten abrechnen", "📊 Bericht fertig machen", "📞 Zurückrufen", "📅 Urlaub beantragen"],
  schicht: ["📅 Urlaub beantragen", "🔁 Tausch klären", "👕 Arbeitskleidung waschen", "🍱 Essen vorkochen", "😴 Schlaf nachholen"],
  eltern: ["🧸 Kita-Tasche packen", "🩺 Kinderarzt anrufen", "🎁 Geschenk besorgen", "📝 Elternbrief unterschreiben", "🍎 Brotdose packen"],
  anders: ["🛒 Einkaufen", "🧺 Wäsche", "📦 Paket abholen", "💡 Rechnung zahlen", "💊 Rezept abholen"],
};

/** Die Rollen in der Reihenfolge für die Leiste: eigene zuerst. */
export function rollenReihe(eigene: Rolle[]): Rolle[] {
  const alle = ROLLEN.map((r) => r.id);
  return [...eigene.filter((r) => alle.includes(r)), ...alle.filter((r) => !eigene.includes(r))];
}

/** Titel mit Symbol, z. B. „🦷 Zahnarzt“. */
export const mitSymbol = (v: Vorlage) => (v.icon ? `${v.icon} ${v.titel}` : v.titel);

// ---- Vorlieben laden (einmal je Seitenaufruf) ------------------------------------

let zwischen: Vorlieben | null = null;
const hoerer = new Set<(v: Vorlieben) => void>();

export function useVorlieben() {
  const [v, setV] = useState<Vorlieben | null>(zwischen);
  useEffect(() => {
    hoerer.add(setV);
    if (!zwischen) {
      fetchVorlieben()
        .then((neu) => {
          zwischen = neu;
          for (const h of hoerer) h(neu);
        })
        .catch(() => {
          zwischen = LEERE_VORLIEBEN;
          for (const h of hoerer) h(LEERE_VORLIEBEN);
        });
    }
    return () => {
      hoerer.delete(setV);
    };
  }, []);

  const setzen = useCallback(async (rollen: Rolle[] | null, vorlagen: Vorlage[] | null) => {
    const alt = zwischen ?? LEERE_VORLIEBEN;
    const neu: Vorlieben = { rollen: rollen ?? alt.rollen, vorlagen: vorlagen ?? alt.vorlagen, gefragt: true };
    zwischen = neu;
    for (const h of hoerer) h(neu);
    try {
      await vorliebenSetzen(rollen, vorlagen);
    } catch (e) {
      zwischen = alt;
      for (const h of hoerer) h(alt);
      throw e;
    }
  }, []);

  return { vorlieben: v, setzen };
}

// ---- „Was passt zu dir?“ ---------------------------------------------------------

export function RollenAuswahl({ gewaehlt, onWechsel }: { gewaehlt: Rolle[]; onWechsel: (r: Rolle[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {ROLLEN.map((r) => {
        const an = gewaehlt.includes(r.id);
        return (
          <button
            key={r.id}
            type="button"
            aria-pressed={an}
            onClick={() => onWechsel(an ? gewaehlt.filter((x) => x !== r.id) : [...gewaehlt, r.id])}
            className={cn(
              "relative flex min-h-[104px] flex-col items-start gap-1 rounded-[20px] p-3.5 text-left transition-colors",
              an ? "bg-[#FFF1D6] ring-[2.5px] ring-inset ring-ink" : "bg-surface/70 ring-1 ring-inset ring-ink/10",
            )}
          >
            <span aria-hidden className="text-[28px] leading-none">
              {r.icon}
            </span>
            <span className="text-[15.5px] font-bold text-ink">{r.name}</span>
            <span className="text-[12.5px] text-ink-muted">{r.beispiel}</span>
            {an ? (
              <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-surface">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Einmalige Frage, bevor die ersten Vorschläge kommen. */
export function WasPasstZuDir({ onFertig }: { onFertig: () => void }) {
  const { vorlieben, setzen } = useVorlieben();
  const [wahl, setWahl] = useState<Rolle[]>(vorlieben?.rollen ?? []);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function weiter(rollen: Rolle[]) {
    setLaeuft(true);
    try {
      await setzen(rollen, null);
      onFertig();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden.");
      setLaeuft(false);
    }
  }

  return (
    <Blatt
      titel="👋 Was passt zu dir?"
      unter="Dann zeigen wir dir passende Vorschläge. Mehrere gehen, ändern jederzeit."
      onClose={() => void weiter(wahl)}
      fuss={
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={laeuft}
            onClick={() => void weiter([])}
            className="h-12 px-3 text-[14.5px] font-semibold text-ink-muted"
          >
            Überspringen
          </button>
          <button
            type="button"
            disabled={laeuft}
            onClick={() => void weiter(wahl)}
            className="h-12 flex-1 rounded-[16px] bg-ink text-[16px] font-bold text-surface disabled:opacity-60"
          >
            Weiter
          </button>
        </div>
      }
    >
      <RollenAuswahl gewaehlt={wahl} onWechsel={setWahl} />
      {fehler ? <p className="mt-3 rounded-xl bg-crit-bg px-3 py-2 text-[13px] text-crit-fg">{fehler}</p> : null}
    </Blatt>
  );
}
