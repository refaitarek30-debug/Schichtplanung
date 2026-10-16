"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { pushAnschalten, pushAusschalten, pushStatus, type PushStatus } from "@/lib/push";
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
    <div className={cn("rounded-[16px] bg-[#FFF4E0] px-3.5 py-3 text-[13px] leading-snug text-ink", className)}>
      <p className="flex gap-2">
        <BellRing aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#B4501A]" />
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
          <span className="block text-[15px] font-medium">🔔 Erinnerungen auf diesem Gerät</span>
          <span className="block text-[13px] text-ink-muted">
            {status === null ? "…" : an ? "An – Termine und To-dos mit Erinnerung melden sich." : schaltbar ? "Aus" : TEXT[status as Exclude<PushStatus, "an">]}
          </span>
        </span>
        {schaltbar ? (
          <button
            type="button"
            role="switch"
            aria-checked={an}
            aria-label="Erinnerungen auf diesem Gerät"
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
