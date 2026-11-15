"use client";

import { useEffect, useState, useTransition } from "react";
import { Blatt } from "@/components/privat/blatt";
import { useSession } from "@/context/session";
import { createClient } from "@/lib/supabase/client";
import { dataErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

/**
 * Berufsschule selbst eintragen (Migration 0224, nur Auszubildende).
 * Zeitraum und Wochentage wählen – z. B. „jeden Montag bis Juli“.
 * Die Datenbank prüft selbst, dass nur Azubis für sich eintragen.
 */

const WOCHENTAGE = [
  [1, "Mo"],
  [2, "Di"],
  [3, "Mi"],
  [4, "Do"],
  [5, "Fr"],
  [6, "Sa"],
] as const;

let azubiMerker: { employeeId: string; azubi: boolean } | null = null;

/** Ist die angemeldete Person Auszubildende? (eigene Zeile, einmal je Sitzung gelesen) */
export function useIstAzubi(): boolean {
  const { mode, profile } = useSession();
  const id = profile.employeeId;
  const [azubi, setAzubi] = useState(() => (azubiMerker && azubiMerker.employeeId === id ? azubiMerker.azubi : false));
  useEffect(() => {
    if (mode !== "live" || !id || (azubiMerker && azubiMerker.employeeId === id)) return;
    let aktiv = true;
    createClient()
      .from("employees")
      .select("is_apprentice")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        const wert = data?.is_apprentice === true;
        azubiMerker = { employeeId: id, azubi: wert };
        if (aktiv) setAzubi(wert);
      });
    return () => {
      aktiv = false;
    };
  }, [mode, id]);
  return azubi;
}

export function BerufsschuleBlatt({ onClose }: { onClose: () => void }) {
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [tage, setTage] = useState<number[]>([]);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, starte] = useTransition();
  const fertig = Boolean(von && bis && bis >= von);

  function senden(entfernen: boolean) {
    if (!fertig) return;
    setMeldung(null);
    starte(async () => {
      const { data, error } = await createClient().rpc("berufsschule_selbst", {
        p_von: von,
        p_bis: bis,
        p_wochentage: tage.length ? tage : null,
        p_entfernen: entfernen,
      });
      if (error) {
        setMeldung({ ok: false, text: dataErrorMessage(error) ?? "Das hat nicht geklappt." });
        return;
      }
      const n = Number(data ?? 0);
      setMeldung({ ok: true, text: entfernen ? `${n} ${n === 1 ? "Tag" : "Tage"} entfernt.` : `${n} ${n === 1 ? "Tag" : "Tage"} eingetragen.` });
    });
  }

  const feld = "h-11 w-full min-w-0 rounded-[12px] border border-ink/[0.12] bg-transparent px-3 text-[15px]";
  return (
    <Blatt titel="Berufsschule" onClose={onClose} wischZu="kopf">
      <div className="space-y-3" data-berufsschule>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[13px] text-ink-muted">
            Von
            <input type="date" value={von} onChange={(e) => (setVon(e.target.value), (!bis || bis < e.target.value) && setBis(e.target.value))} className={feld} />
          </label>
          <label className="text-[13px] text-ink-muted">
            Bis
            <input type="date" value={bis} min={von || undefined} onChange={(e) => setBis(e.target.value)} className={feld} />
          </label>
        </div>
        <div>
          <p className="pb-1.5 text-[13px] text-ink-muted">Nur an diesen Tagen (leer = jeden Tag)</p>
          <div className="flex flex-wrap gap-1.5">
            {WOCHENTAGE.map(([n, t]) => {
              const an = tage.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={an}
                  onClick={() => setTage((alt) => (an ? alt.filter((x) => x !== n) : [...alt, n]))}
                  className={cn("h-10 w-12 rounded-full text-[14px] font-semibold", an ? "bg-ink text-surface" : "bg-ink/[0.06]")}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" disabled={!fertig || laeuft} onClick={() => senden(false)} className="h-12 flex-1 rounded-[14px] bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40">
            Eintragen
          </button>
          <button type="button" disabled={!fertig || laeuft} onClick={() => senden(true)} className="h-12 rounded-[14px] border border-ink/[0.12] px-4 text-[15px] font-semibold disabled:opacity-40">
            Entfernen
          </button>
        </div>
        {meldung ? <p className={cn("text-[14px]", meldung.ok ? "text-ok-fg" : "text-crit-fg")}>{meldung.text}</p> : null}
      </div>
    </Blatt>
  );
}
