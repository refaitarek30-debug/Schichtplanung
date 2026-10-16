"use client";

import { useCallback, useEffect, useState } from "react";
import { Smartphone, Users } from "lucide-react";
import { GruppenListe, KalenderTeilen, PersonenListe } from "@/components/kalender/teilen";
import { fetchGruppen, type Gruppe } from "@/lib/data/gruppen";
import { KalenderAboCard } from "@/components/settings/kalender-abo-card";
import { fetchPersonen, type Person } from "@/lib/data/partner";
import { usePrivat } from "./kontext";
import { PrivatKopf } from "./rahmen";

/** Personen einladen (Partner, Familie, Freunde) und Kalender-Abo fürs Handy. */
export function PrivatTeilen() {
  const { konto } = usePrivat();
  const [personen, setPersonen] = useState<Person[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gruppen, setGruppen] = useState<Gruppe[] | null>(null);
  const [offen, setOffen] = useState<"neu" | "gruppeNeu" | { person: string } | { gruppe: string } | null>(null);
  const vorname = konto.name.split(/\s+/)[0] ?? konto.name;

  const laden = useCallback(async () => {
    try {
      const [p, g] = await Promise.all([fetchPersonen(), fetchGruppen()]);
      setPersonen(p);
      setGruppen(g);
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Personen konnten nicht geladen werden.");
      setPersonen((a) => a ?? []);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden]);

  return (
    <div className="space-y-4">
      <PrivatKopf titel="Teilen" unter="Wer deinen Kalender sehen darf." />

      <div className="flex items-center gap-2 pt-1 text-[13px] font-semibold text-ink-muted">
        <Users className="h-4 w-4" /> Partner, Familie, Freunde
      </div>
      {fehler ? <p className="rounded-xl bg-crit-bg px-3 py-2 text-[13px] text-crit-fg">{fehler}</p> : null}
      <PersonenListe personen={personen} onNeu={() => setOffen("neu")} onPerson={(id) => setOffen({ person: id })} />

      <div className="flex items-center gap-2 pt-3 text-[13px] font-semibold text-ink-muted">
        <Users className="h-4 w-4" /> Gruppen
      </div>
      <GruppenListe gruppen={gruppen} onNeu={() => setOffen("gruppeNeu")} onGruppe={(id) => setOffen({ gruppe: id })} />

      <div className="flex items-center gap-2 pt-3 text-[13px] font-semibold text-ink-muted">
        <Smartphone className="h-4 w-4" /> Im Kalender deines Handys
      </div>
      <KalenderAboCard />

      {offen ? (
        <KalenderTeilen vorname={vorname} start={offen} onGeaendert={() => void laden()} onClose={() => setOffen(null)} />
      ) : null}
    </div>
  );
}
