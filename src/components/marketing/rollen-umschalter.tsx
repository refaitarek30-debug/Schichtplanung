"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** „Jeder sieht, was er braucht“ – drei Rollen zum Umschalten. */
const ROLLEN = [
  {
    name: "Betriebsleitung",
    kurz: "Leitung",
    satz: "Regeln festlegen, Überblick behalten.",
    punkte: ["Schichten, Gruppen und Mindestbesetzung", "Konten und Urlaubssperren", "Mitarbeiter einladen, Rollen vergeben"],
  },
  {
    name: "Schichtleitung",
    kurz: "Schichtleitung",
    satz: "Entscheiden mit Blick auf die Besetzung.",
    punkte: ["Anträge genehmigen oder ablehnen", "Krank und Abwesenheiten eintragen", "Engpässe vor Schichtbeginn sehen"],
  },
  {
    name: "Mitarbeiter",
    kurz: "Mitarbeiter",
    satz: "Eigene Schichten, alles auf dem Handy.",
    punkte: ["Urlaub direkt aus dem Plan beantragen", "Konten und Antragsstand jederzeit", "Kalender mit Partner teilen, im Handy-Kalender"],
  },
];

export function RollenUmschalter() {
  const [wahl, setWahl] = useState(0);
  const r = ROLLEN[wahl];
  return (
    <div className="rounded-[24px] border border-line bg-surface p-2 shadow-card">
      <div role="tablist" aria-label="Rolle" className="grid grid-cols-3 gap-1 rounded-[18px] bg-surface-muted p-1">
        {ROLLEN.map((x, i) => (
          <button
            key={x.name}
            type="button"
            role="tab"
            aria-selected={wahl === i}
            onClick={() => setWahl(i)}
            className={cn(
              "truncate rounded-[14px] px-2 py-2.5 text-[13px] font-semibold transition-colors sm:text-[14px]",
              wahl === i ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
            )}
          >
            <span className="sm:hidden">{x.kurz}</span>
            <span className="hidden sm:inline">{x.name}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" className="px-4 pb-4 pt-5 sm:px-6 sm:pb-6">
        <p className="text-[20px] font-semibold tracking-tight sm:text-[22px]">{r.satz}</p>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {r.punkte.map((p) => (
            <li key={p} className="flex items-start gap-2.5 rounded-2xl bg-surface-muted px-3.5 py-3 text-[14px] leading-snug">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} aria-hidden />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
