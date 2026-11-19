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
      setVerbindungen((a) => a ?? []);
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

      {/* Drei Wege oben: einladen (Link), eigener Code, Code eingeben. */}
      <section className="grid grid-cols-3 gap-2" data-teilen-einladen>
        <Kachel an icon={UserPlus} text="Einladen" onClick={() => setOffen("neu")} />
        <Kachel icon={QrCode} text="Mein Code" onClick={() => setOffen("code")} />
        <Kachel icon={Link2} text="Code eingeben" onClick={() => setOffen("codeEingeben")} />
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
                status="gut"
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
                status={einladungen[p.id] ? "wartet" : !p.linkAktiv ? "aus" : "gut"}
              />
            ))}
          </ul>
        )}
        <p className="px-1 text-[12.5px] leading-snug text-ink-muted">Sie sehen deine Schichten – Krank und Urlaub nur als „frei“.</p>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-muted">Gruppen</h2>
        <GruppenListe gruppen={gruppen} onNeu={() => setOffen("gruppeNeu")} onGruppe={(id) => setOffen({ gruppe: id })} />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-muted">Kalender-Abo</h2>
        <KalenderAboCard />
      </section>

      {offen ? (
        <KalenderTeilen vorname={vorname} start={offen} onGeaendert={() => void laden()} onClose={() => setOffen(null)} />
      ) : null}
    </div>
  );
}

function Kachel({
  icon: Icon,
  text,
  an = false,
  onClick,
}: {
  icon: typeof UserPlus;
  text: string;
  an?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-[18px] px-1 text-[13.5px] font-semibold transition-transform active:scale-[0.97]",
        an ? "bg-brand-600 text-white" : "glas text-ink",
      )}
    >
      <Icon className="h-[22px] w-[22px]" />
      <span className="leading-tight">{text}</span>
    </button>
  );
}

const PUNKT = { gut: "bg-[#34c759]", wartet: "bg-[#ff9f0a]", aus: "bg-ink-faint" } as const;

function Zeile({
  name,
  farbe,
  unter,
  status,
  onClick,
}: {
  name: string;
  farbe: string;
  unter: string;
  /** Punkt vor der Unterzeile: verbunden/aktiv, Einladung offen, Link beendet. */
  status: keyof typeof PUNKT;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink/[0.04]">
        <PersonAvatar name={name} farbe={farbe} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">{name}</span>
          <span className="flex items-center gap-1.5 truncate text-[12.5px] text-ink-muted">
            <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", PUNKT[status])} />
            <span className="truncate">{unter}</span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
      </button>
    </li>
  );
}
