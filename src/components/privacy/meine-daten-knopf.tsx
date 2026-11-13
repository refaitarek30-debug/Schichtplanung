"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * „Meine Daten herunterladen“ (Art. 15 und 20 DSGVO, Migration 0220): alles,
 * was zu dieser Person gespeichert ist, als JSON-Datei. Die Datei entsteht
 * nur im Browser – sie wird nirgends zwischengespeichert.
 */
export function MeineDatenKnopf({ className }: { className?: string }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function laden() {
    setLaeuft(true);
    setFehler(null);
    const { data, error } = await createClient().rpc("meine_daten");
    setLaeuft(false);
    if (error || !data) {
      setFehler("Das hat gerade nicht geklappt. Bitte gleich noch einmal versuchen.");
      return;
    }
    const tag = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `shiftnexo-meine-daten-${tag}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className={className} data-meine-daten>
      <button
        type="button"
        onClick={laden}
        disabled={laeuft}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium disabled:opacity-60",
        )}
      >
        <Download className="h-5 w-5 text-ink-muted" />
        <span className="min-w-0 flex-1">
          {laeuft ? "Wird zusammengestellt …" : "Meine Daten herunterladen"}
          <span className="block text-[12.5px] font-normal text-ink-muted">
            Alles, was ShiftNexo über dich gespeichert hat – als Datei (DSGVO).
          </span>
        </span>
      </button>
      {fehler ? <p className="px-4 pb-3 text-[13px] text-crit-fg">{fehler}</p> : null}
    </div>
  );
}
