"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarHeart, ChevronRight, Link2, Smartphone, Users } from "lucide-react";
import { GruppenListe, KalenderTeilen, PERSON_FARBEN, PersonenListe } from "@/components/kalender/teilen";
import { VerbindungenListe } from "@/components/kalender/verbinden";
import { fetchVerbindungen, type Verbindung } from "@/lib/data/verbindungen";
import { fetchGruppen, type Gruppe } from "@/lib/data/gruppen";
import { KalenderAboCard } from "@/components/settings/kalender-abo-card";
import { fetchEinladungen, fetchPersonen, type Person } from "@/lib/data/partner";
import { usePrivat } from "./kontext";
import { PrivatKopf } from "./rahmen";

/** Personen einladen (Partner, Familie, Freunde) und Kalender-Abo fürs Handy. */
export function PrivatTeilen() {
  const { konto } = usePrivat();
  const [personen, setPersonen] = useState<Person[] | null>(null);
  const [einladungen, setEinladungen] = useState<Record<string, string>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const [gruppen, setGruppen] = useState<Gruppe[] | null>(null);
  const [verbindungen, setVerbindungen] = useState<Verbindung[] | null>(null);
  const [offen, setOffen] = useState<
    "neu" | "gruppeNeu" | "code" | "codeEingeben" | { person: string } | { gruppe: string } | { verbindung: string } | null
  >(null);
  const vorname = konto.name.split(/\s+/)[0] ?? konto.name;

  const laden = useCallback(async () => {
    try {
      const [p, g, v, e] = await Promise.all([
        fetchPersonen(),
        fetchGruppen(),
        fetchVerbindungen().catch(() => []),
        fetchEinladungen().catch(() => ({})),
      ]);
      setPersonen(p);
      setEinladungen(e);
      setGruppen(g);
      setVerbindungen(v);
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

      <Link href="/privat/schichten?reiter=gemeinsam" className="glas flex items-center gap-3 rounded-[20px] px-4 py-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ok-bg text-ok-fg">
          <CalendarHeart className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Gemeinsam frei</span>
          <span className="block text-[13px] text-ink-muted">Wann habt ihr beide frei? Monat, Jahr und ganze Wochenenden</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
      </Link>

      <div className="flex items-center gap-2 pt-1 text-[13px] font-semibold text-ink-muted">
        <Users className="h-4 w-4" /> Partner, Familie, Freunde
      </div>
      {fehler ? <p className="rounded-xl bg-crit-bg px-3 py-2 text-[13px] text-crit-fg">{fehler}</p> : null}
      <PersonenListe personen={personen} einladungen={einladungen} onNeu={() => setOffen("neu")} onPerson={(id) => setOffen({ person: id })} />

      <div className="flex items-center gap-2 pt-3 text-[13px] font-semibold text-ink-muted">
        <Link2 className="h-4 w-4" /> Mit eigenem Konto verbunden
      </div>
      <VerbindungenListe
        verbindungen={verbindungen}
        farbe={(v) => PERSON_FARBEN[((personen?.length ?? 0) + (verbindungen?.indexOf(v) ?? 0)) % PERSON_FARBEN.length]}
        onVerbindung={(id) => setOffen({ verbindung: id })}
        onCodeZeigen={() => setOffen("code")}
        onCodeEingeben={() => setOffen("codeEingeben")}
      />

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
