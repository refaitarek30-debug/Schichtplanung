"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Link2, QrCode, UserPlus } from "lucide-react";
import { GruppenListe, KalenderTeilen, PERSON_FARBEN, PersonAvatar, personFarbe } from "@/components/kalender/teilen";
import { fetchVerbindungen, type Verbindung } from "@/lib/data/verbindungen";
import { fetchGruppen, type Gruppe } from "@/lib/data/gruppen";
import { KalenderAboCard } from "@/components/settings/kalender-abo-card";
import { PERSON_ARTEN, fetchEinladungen, fetchPersonen, type Person } from "@/lib/data/partner";
import { cn } from "@/lib/utils";
import { usePrivat } from "./kontext";
import { PrivatKopf } from "./rahmen";

/**
 * Teilen: oben einladen (Link oder Code), darunter eine Liste „Deine Leute“
 * (verbundene Konten und eingeladene Personen), Gruppen und Kalender-Abo.
 */
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

  const anzahl = (personen?.length ?? 0) + (verbindungen?.length ?? 0);
  const artName = (art: string) => PERSON_ARTEN.find((a) => a.art === art)?.text ?? art;

  return (
    <div className="space-y-5">
      <PrivatKopf titel="Teilen" unter="Wer deinen Kalender sieht" />

      {/* Einladen: ein klarer Weg, dazu die Codes für Leute mit eigenem Kalender. */}
      <section className="glas space-y-3 rounded-[24px] p-4" data-teilen-einladen>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-500/12 text-brand-600">
            <UserPlus className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold leading-tight">Partner, Familie, Freunde</h2>
            <p className="mt-0.5 text-[13.5px] leading-snug text-ink-muted">Sie sehen deine Schichten – Krank und Urlaub nur als „frei“.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOffen("neu")}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-brand-600 text-[15.5px] font-semibold text-white"
        >
          <UserPlus className="h-[18px] w-[18px]" /> Person einladen
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOffen("code")}
            className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] bg-ink/[0.06] text-[14px] font-semibold"
          >
            <QrCode className="h-4 w-4" /> Mein Code
          </button>
          <button
            type="button"
            onClick={() => setOffen("codeEingeben")}
            className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] bg-ink/[0.06] text-[14px] font-semibold"
          >
            <Link2 className="h-4 w-4" /> Code eingeben
          </button>
        </div>
        <p className="text-[12px] leading-snug text-ink-faint">Hat die Person schon ShiftNexo? Dann verbindet ihr euch per Code.</p>
      </section>

      {fehler ? <p className="rounded-xl bg-crit-bg px-3 py-2 text-[13px] text-crit-fg">{fehler}</p> : null}

      <section className="space-y-2">
        <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
          Deine Leute{anzahl ? ` · ${anzahl}` : ""}
        </h2>
        {personen === null || verbindungen === null ? (
          <div className="glas h-16 animate-pulse rounded-[22px]" />
        ) : anzahl === 0 ? (
          <p className="glas rounded-[22px] px-4 py-5 text-center text-[14px] leading-snug text-ink-muted">
            Noch niemand. Lade jemanden ein – dann seht ihr, wann der andere arbeitet.
          </p>
        ) : (
          <ul className="glas divide-y divide-line overflow-hidden rounded-[22px]" data-deine-leute>
            {verbindungen.map((v, i) => (
              <Zeile
                key={v.id}
                onClick={() => setOffen({ verbindung: v.id })}
                name={v.name || "Ohne Namen"}
                farbe={PERSON_FARBEN[(personen.length + i) % PERSON_FARBEN.length]!}
                unter={`${artName(v.art)} · eigener Kalender`}
                marke={{ text: "verbunden", gut: true }}
              />
            ))}
            {personen.map((p) => (
              <Zeile
                key={p.id}
                onClick={() => setOffen({ person: p.id })}
                name={p.name}
                farbe={personFarbe(personen, p.id)}
                unter={`${artName(p.art)} · ${
                  einladungen[p.id] ? "Einladung offen" : !p.linkAktiv ? "Link beendet" : p.darfEintragen ? "darf eintragen" : "sieht mit"
                }`}
                marke={einladungen[p.id] ? { text: "wartet", gut: false } : null}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-muted">Gruppen</h2>
        <GruppenListe gruppen={gruppen} onNeu={() => setOffen("gruppeNeu")} onGruppe={(id) => setOffen({ gruppe: id })} />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-muted">Im Kalender deines Handys</h2>
        <KalenderAboCard />
      </section>

      {offen ? (
        <KalenderTeilen vorname={vorname} start={offen} onGeaendert={() => void laden()} onClose={() => setOffen(null)} />
      ) : null}
    </div>
  );
}

function Zeile({
  name,
  farbe,
  unter,
  marke,
  onClick,
}: {
  name: string;
  farbe: string;
  unter: string;
  marke: { text: string; gut: boolean } | null;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink/[0.04]">
        <PersonAvatar name={name} farbe={farbe} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">{name}</span>
          <span className="block truncate text-[12.5px] text-ink-muted">{unter}</span>
        </span>
        {marke ? (
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold", marke.gut ? "bg-ok-bg text-ok-fg" : "bg-warn-bg text-warn-fg")}>
            {marke.text}
          </span>
        ) : null}
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
      </button>
    </li>
  );
}
