"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Link2, Plus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Drei kurze Fenster beim ersten Öffnen des Kalenders: was er kann und wie
 * es geht. Die Bilder sind kleine Nachbauten der echten Oberfläche – keine
 * Grafikdateien, damit sie im Hell- und Dunkelmodus passen.
 */

function Kaestchen({ t, k, umriss }: { t: string; k: string; umriss?: boolean }) {
  return (
    <span
      className={cn(
        "block truncate rounded-md px-0.5 py-[2px] text-center text-[10px] font-semibold leading-tight",
        umriss ? `ring-[1.5px] ring-inset ${k}` : k,
      )}
    >
      {t}
    </span>
  );
}

const F = "bg-shift-frueh text-shift-frueh-ink";
const S = "bg-shift-spaet text-shift-spaet-ink";
const N = "bg-shift-nacht text-shift-nacht-ink";
const X = "bg-surface-sunken text-ink-faint";

function BildMonat() {
  const reihe: [string, string][] = [
    ["Früh", F], ["Früh", F], ["Spät", S], ["Spät", S], ["Nacht", N], ["Nacht", N], ["Frei", X],
  ];
  return (
    <div className="rounded-2xl border border-line bg-surface p-2">
      <div className="mb-1 flex items-baseline justify-between px-1">
        <span className="text-[15px] font-bold">Oktober</span>
        <span className="text-[11px] text-ink-faint">‹ ›</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {reihe.concat(reihe.slice(2), reihe.slice(0, 2)).map(([t, k], i) => (
          <div key={i} className="space-y-0.5">
            <span className="block text-center text-[10px] font-medium">{i + 5}</span>
            <Kaestchen t={t} k={k} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BildBlase() {
  return (
    <div className="space-y-2">
      <div className="mx-auto grid w-2/3 grid-cols-3 gap-1">
        <Kaestchen t="Spät" k={S} />
        <span className="rounded-md ring-2 ring-brand-500">
          <Kaestchen t="Früh" k={F} />
        </span>
        <Kaestchen t="Früh" k={F} />
      </div>
      <div className="rounded-2xl border border-line bg-surface px-3 pt-2 shadow-pop">
        <div className="flex items-center gap-2 pb-2">
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold", F)}>F</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-tight">Frühschicht</p>
            <p className="text-[11px] text-ink-muted">06:00 – 14:00 Uhr</p>
          </div>
          <span className="text-[11px] text-ink-muted">8 Std.</span>
        </div>
        <div className="-mx-3 grid grid-cols-2 border-t border-line text-[12px] font-semibold text-ink-muted">
          <span className="flex items-center justify-center gap-1 py-2">
            <Plus className="h-3.5 w-3.5" /> Termin
          </span>
          <span className="flex items-center justify-center gap-1 border-l border-line py-2">
            <Plus className="h-3.5 w-3.5" /> Partner
          </span>
        </div>
      </div>
    </div>
  );
}

function BildPartner() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <UserPlus className="h-4 w-4" />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1 truncate rounded-lg bg-surface-muted px-2 py-1 font-mono text-[10px] text-ink-muted">
          <Link2 className="h-3 w-3 shrink-0" /> …/verbinden/K7P4QX
        </span>
        <span className="rounded-lg bg-brand-500 px-2 py-1 text-[11px] font-semibold text-white">Einladen</span>
      </div>
      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-line bg-surface p-2">
        {[
          ["Früh", F, "Arbeit"],
          ["Spät", S, "Arbeit"],
          ["Urlaub", "bg-shift-urlaub text-shift-urlaub-ink", "Frei"],
          ["Frei", X, "Urlaub"],
        ].map(([a, k, p], i) => (
          <div key={i} className="space-y-0.5">
            <Kaestchen t={a!} k={k!} />
            <Kaestchen
              t={p!}
              k={p === "Urlaub" ? "ring-shift-urlaub-ink/70 text-shift-urlaub-ink" : "ring-brand-600/70 text-brand-700"}
              umriss
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const SCHRITTE = [
  {
    titel: "Dein Kalender",
    text: "Deine Schichten im Monat. Wischen wechselt den Monat.",
    bild: <BildMonat />,
  },
  {
    titel: "Termine",
    text: "Tag antippen – Termine eintragen, ansehen und ändern.",
    bild: <BildBlase />,
  },
  {
    titel: "Mit deinem Partner",
    text: "Oben auf das Personen-Symbol tippen und einladen – mit dem Link legt dein Partner kurz ein Konto an. Ihr seht beide eure Schichten, Urlaub und Termine.",
    bild: <BildPartner />,
  },
];

export function KalenderEinfuehrung({ onFertig }: { onFertig: () => void }) {
  const [schritt, setSchritt] = useState(0);
  const s = SCHRITTE[schritt]!;
  const letzter = schritt === SCHRITTE.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Neu: Kalender – ${s.titel}`}
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-surface shadow-pop"
      >
        <div className="bg-surface-muted px-5 pb-4 pt-5">{s.bild}</div>
        <div className="space-y-2 px-5 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">
            Neu · {schritt + 1} von {SCHRITTE.length}
          </p>
          <p className="text-[19px] font-bold leading-snug">{s.titel}</p>
          <p className="text-[14px] leading-relaxed text-ink-muted">{s.text}</p>
        </div>
        <div className="flex items-center justify-between gap-3 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <div className="flex gap-1.5" aria-hidden>
            {SCHRITTE.map((_, i) => (
              <span
                key={i}
                className={cn("h-1.5 rounded-full", i === schritt ? "w-5 bg-brand-500" : "w-1.5 bg-line")}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!letzter ? (
              <button type="button" onClick={onFertig} className="px-2 py-2 text-[14px] font-semibold text-ink-muted">
                Überspringen
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (letzter ? onFertig() : setSchritt(schritt + 1))}
              className="h-11 rounded-xl bg-brand-500 px-5 text-[15px] font-semibold text-white"
            >
              {letzter ? "Los geht’s" : "Weiter"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
