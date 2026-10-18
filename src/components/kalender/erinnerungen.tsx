"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { fetchPushAus, pushAnschalten, pushAusSetzen, pushAusschalten, pushStatus, type MitteilungsArt, type PushStatus } from "@/lib/push";
import { cn } from "@/lib/utils";

/** Stand der Mitteilungen auf diesem Gerät – mit An und Aus. */
export function usePush() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let aus = false;
    void pushStatus().then((s) => !aus && setStatus(s));
    return () => {
      aus = true;
    };
  }, []);

  async function umschalten(an: boolean) {
    setLaeuft(true);
    setFehler(null);
    try {
      setStatus(an ? await pushAnschalten() : await pushAusschalten());
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  }

  return { status, laeuft, fehler, umschalten };
}

const TEXT: Record<Exclude<PushStatus, "an">, string> = {
  aus: "Damit die Erinnerung auf diesem Gerät ankommt, erlaube Mitteilungen.",
  gesperrt: "Mitteilungen sind für diese Seite gesperrt. Erlaube sie in den Einstellungen des Browsers bzw. des Handys.",
  "ios-home": "Auf dem iPhone: In Safari auf Teilen → „Zum Home-Bildschirm“ und die App von dort öffnen. Dann gehen Mitteilungen.",
  "nicht-moeglich": "Dieser Browser kann keine Mitteilungen. Probier es in Chrome, Edge, Firefox oder Safari (iPhone: vom Home-Bildschirm).",
};

/** Kleiner Hinweis im Formular, wenn eine Erinnerung gewählt ist, aber noch keine Mitteilungen gehen. */
export function ErinnerungHinweis({ className }: { className?: string }) {
  const { status, laeuft, fehler, umschalten } = usePush();
  if (!status || status === "an") return null;
  return (
    <div className={cn("rounded-[16px] bg-warn-bg px-3.5 py-3 text-[13px] leading-snug text-ink", className)}>
      <p className="flex gap-2">
        <BellRing aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warn-fg" />
        <span>{TEXT[status]}</span>
      </p>
      {status === "aus" ? (
        <button
          type="button"
          disabled={laeuft}
          onClick={() => void umschalten(true)}
          className="mt-2 h-9 rounded-full bg-ink px-4 text-[13.5px] font-bold text-surface disabled:opacity-60"
        >
          {laeuft ? "Einen Moment …" : "Mitteilungen erlauben"}
        </button>
      ) : null}
      {fehler ? <p className="mt-1.5 text-crit-fg">{fehler}</p> : null}
    </div>
  );
}

/** Für die Einstellungen: Erinnerungen auf diesem Gerät an oder aus. */
export function ErinnerungenGeraet({ className }: { className?: string }) {
  const { status, laeuft, fehler, umschalten } = usePush();
  const an = status === "an";
  const schaltbar = status === "an" || status === "aus";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[15px] font-medium">🔔 Mitteilungen auf diesem Gerät</span>
          <span className="block text-[13px] text-ink-muted">
            {status === null ? "…" : an ? "An – Wichtiges kommt direkt aufs Handy." : schaltbar ? "Aus" : TEXT[status as Exclude<PushStatus, "an">]}
          </span>
        </span>
        {schaltbar ? (
          <button
            type="button"
            role="switch"
            aria-checked={an}
            aria-label="Mitteilungen auf diesem Gerät"
            disabled={laeuft}
            onClick={() => void umschalten(!an)}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
              an ? "bg-brand-500" : "bg-ink/[0.12]",
            )}
          >
            <span
              className={cn(
                "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform",
                an ? "translate-x-[1.375rem]" : "translate-x-0.5",
              )}
            />
          </button>
        ) : null}
      </div>
      {fehler ? <p className="text-[13px] text-crit-fg">{fehler}</p> : null}
    </div>
  );
}

const ARTEN: { id: MitteilungsArt; titel: string; text: string; firma: boolean }[] = [
  { id: "antraege", titel: "Anträge", text: "Urlaub genehmigt oder abgelehnt, neue Anträge (Leitung)", firma: true },
  { id: "plan", titel: "Planänderungen", text: "Wenn die Schichtleitung deinen Plan ändert oder eine Fehlzeit einträgt", firma: true },
  { id: "einspringen", titel: "Einspringen", text: "Wenn du gefragt wirst, ob du einspringen kannst", firma: true },
  { id: "teilen", titel: "Partner, Familie & Gruppen", text: "Wenn jemand bei dir einträgt, sich verbindet oder einer Gruppe beitritt", firma: false },
];

/** Welche Mitteilungen kommen – je Art abschaltbar. Erinnerungen an Termine kommen immer, wenn eingestellt. */
export function MitteilungsArten({ firma }: { firma: boolean }) {
  const [aus, setAus] = useState<MitteilungsArt[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    let weg = false;
    void fetchPushAus().then((a) => !weg && setAus(a));
    return () => {
      weg = true;
    };
  }, []);

  async function umschalten(id: MitteilungsArt) {
    if (!aus) return;
    const neu = aus.includes(id) ? aus.filter((x) => x !== id) : [...aus, id];
    const alt = aus;
    setAus(neu);
    setFehler(null);
    try {
      await pushAusSetzen(neu);
    } catch (e) {
      setAus(alt);
      setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden.");
    }
  }

  return (
    <div className="space-y-2.5">
      {ARTEN.filter((a) => firma || !a.firma).map((a) => {
        const an = aus ? !aus.includes(a.id) : true;
        return (
          <label key={a.id} className="flex cursor-pointer items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[14.5px] font-medium">{a.titel}</span>
              <span className="block text-[12.5px] text-ink-muted">{a.text}</span>
            </span>
            <input
              type="checkbox"
              checked={an}
              disabled={!aus}
              onChange={() => void umschalten(a.id)}
              className="h-5 w-5 shrink-0 accent-brand-500"
            />
          </label>
        );
      })}
      <p className="text-[12.5px] text-ink-muted">Erinnerungen an Termine und To-dos kommen, wenn du sie beim Eintrag wählst.</p>
      {fehler ? <p className="text-[13px] text-crit-fg">{fehler}</p> : null}
    </div>
  );
}

const ANSTOSS_WEG = "schichtplan.push-anstoss-weg";

/** Kleiner Hinweis (Glocke, Profil): Mitteilungen einschalten. Verschwindet, wenn an oder weggeklickt. */
export function PushAnstoss({ className }: { className?: string }) {
  const { status, laeuft, fehler, umschalten } = usePush();
  const [weg, setWeg] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWeg(window.localStorage.getItem(ANSTOSS_WEG) === "1");
    } catch {
      setWeg(false);
    }
  }, []);
  if (weg || !status || status === "an" || status === "nicht-moeglich" || status === "gesperrt") return null;
  return (
    <div className={cn("relative rounded-[16px] bg-warn-bg px-3.5 py-3 pr-10 text-[13px] leading-snug text-ink", className)}>
      <button
        type="button"
        aria-label="Hinweis ausblenden"
        onClick={() => {
          setWeg(true);
          try {
            window.localStorage.setItem(ANSTOSS_WEG, "1");
          } catch {
            // egal
          }
        }}
        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-ink-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="font-semibold">🔔 Wichtiges direkt aufs Handy</p>
      <p className="mt-0.5 text-ink-muted">Urlaub genehmigt, Planänderungen, Einträge von Partner und Familie – sofort als Mitteilung.</p>
      {status === "aus" ? (
        <button
          type="button"
          disabled={laeuft}
          onClick={() => void umschalten(true)}
          className="mt-2 h-9 rounded-full bg-ink px-4 text-[13.5px] font-bold text-surface disabled:opacity-60"
        >
          {laeuft ? "Einen Moment …" : "Mitteilungen einschalten"}
        </button>
      ) : (
        <p className="mt-1.5 text-[12.5px]">{TEXT[status]}</p>
      )}
      {fehler ? <p className="mt-1.5 text-crit-fg">{fehler}</p> : null}
    </div>
  );
}
