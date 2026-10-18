"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PrivatAuswertung } from "./auswertung";
import { PrivatSchichten } from "./schichten";

type Reiter = "uebersicht" | "liste";

/**
 * Schichten und Auswertung auf einer Seite: oben wechselst du zwischen der
 * Übersicht (Zahlen, Stunden, Überstunden) und „Meine Schichten“ (anlegen
 * und bearbeiten). Der Kopf gehört jeweils zur gewählten Hälfte.
 */
export function PrivatSchichtenSeite({ start = "uebersicht" }: { start?: Reiter }) {
  const [reiter, setReiter] = useState<Reiter>(start);
  const wahl = (
    <div role="tablist" aria-label="Schichten" className="glas grid grid-cols-2 rounded-[14px] p-[3px]">
      {([
        ["uebersicht", "Übersicht"],
        ["liste", "Meine Schichten"],
      ] as const).map(([id, name]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={reiter === id}
          onClick={() => setReiter(id)}
          className={cn(
            "rounded-[11px] py-2 text-[14px] font-semibold transition-all",
            reiter === id ? "bg-surface text-ink shadow-[0_2px_8px_rgba(0,0,0,0.1)]" : "text-ink-muted",
          )}
        >
          {name}
        </button>
      ))}
    </div>
  );
  return reiter === "uebersicht" ? <PrivatAuswertung titel="Schichten" unterKopf={wahl} /> : <PrivatSchichten unterKopf={wahl} />;
}
