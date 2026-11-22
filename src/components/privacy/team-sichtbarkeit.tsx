"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useSession } from "@/context/session";
import { Blatt } from "@/components/privat/blatt";
import { Gruppe, Schalter, WahlZeile, Zeile } from "@/components/settings/gruppe";
import {
  ladeTeamSichtbarkeit,
  ladeTeamZahlen,
  setzeTeamModus,
  setzeTeamSichtbarkeit,
  type TeamModus,
  type TeamSichtbarkeit,
  type TeamZahlen,
} from "@/lib/data/team-sichtbarkeit";
import { cn } from "@/lib/utils";

/**
 * Team-Sichtbarkeit (Migration 0237) in der App:
 *  – TeamFrage: einmal beim Start fragen, wenn der Betrieb Zustimmung verlangt.
 *  – TeamSichtbarkeitKarte: die eigene Wahl unter „Was Kollegen sehen“.
 *  – TeamModusKarte: der Schalter des Betriebs (nur Administration).
 *  – PushOhneInhaltZeile: Mitteilungen ohne Inhalt auf dem Sperrbildschirm.
 */

const ERKLAERUNG =
  "Gegenseitig: Wer für eine Seite nein sagt, sieht diese Seite auch nur ohne Namen. Gründe wie Urlaub oder Krank bleiben weiter verborgen. Leitung und Administration sehen immer alles.";

function useTeamSichtbarkeit() {
  const { mode, company } = useSession();
  const [stand, setStand] = useState<TeamSichtbarkeit | null>(null);
  const laden = useCallback(() => {
    if (mode !== "live") return;
    ladeTeamSichtbarkeit(company.id)
      .then(setStand)
      .catch(() => setStand(null));
  }, [mode, company.id]);
  useEffect(laden, [laden]);
  return { stand, setStand, laden };
}

/** Zwei Häkchen: eigene Schichtgruppe, andere Schichtgruppen. */
function Wahl({
  eigene,
  andere,
  onEigene,
  onAndere,
  disabled,
}: {
  eigene: boolean;
  andere: boolean;
  onEigene: () => void;
  onAndere: () => void;
  disabled?: boolean;
}) {
  const punkt = (an: boolean, titel: string, text: string, onClick: () => void, daten: string) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={an}
      onClick={onClick}
      disabled={disabled}
      data-team-wahl={daten}
      className="flex w-full items-center gap-3 rounded-[14px] bg-ink/[0.05] px-3.5 py-3 text-left disabled:opacity-60"
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-2",
          an ? "border-brand-600 bg-brand-600 text-white" : "border-ink/25",
        )}
      >
        {an ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium leading-snug">{titel}</span>
        <span className="block text-[12.5px] leading-snug text-ink-muted">{text}</span>
      </span>
    </button>
  );
  return (
    <div className="space-y-2">
      {punkt(eigene, "Meine Schichtgruppe", "Sie sieht meinen Namen und meine Schichten.", onEigene, "eigene")}
      {punkt(andere, "Andere Schichtgruppen", "Sie sehen meinen Namen und meine Schichten.", onAndere, "andere")}
    </div>
  );
}

/** Einmal beim Start: „Darf dein Team dich im Plan sehen?“ */
export function TeamFrage() {
  const { profile } = useSession();
  const { stand } = useTeamSichtbarkeit();
  const [offen, setOffen] = useState(false);
  const [eigene, setEigene] = useState(false);
  const [andere, setAndere] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!stand || stand.modus !== "zustimmung" || stand.gefragt || !profile.employeeId) return;
    // Weggewischt: in dieser Sitzung nicht noch einmal.
    let spaeter = false;
    try {
      spaeter = sessionStorage.getItem("team-frage-spaeter") === "1";
    } catch {}
    if (!spaeter) setOffen(true);
  }, [stand, profile.employeeId]);

  if (!offen) return null;

  const speichern = async (e: boolean, a: boolean) => {
    setLaeuft(true);
    setFehler(null);
    try {
      await setzeTeamSichtbarkeit({ eigene: e, andere: a });
      setOffen(false);
      // Der Plan holt die Namen beim nächsten Laden neu.
      window.dispatchEvent(new Event("team-sichtbarkeit"));
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Das hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <Blatt
      titel="Darf dein Team dich im Plan sehen?"
      onClose={() => {
        try {
          sessionStorage.setItem("team-frage-spaeter", "1");
        } catch {}
        setOffen(false);
      }}
    >
      <div className="space-y-3 pb-1" data-team-frage>
        <p className="text-[14px] leading-snug text-ink-muted">
          Kolleginnen und Kollegen sehen dann deinen Namen und deine Schichten. Ohne Freigabe erscheinst du für sie als graue
          Zeile ohne Namen.
        </p>
        <Wahl eigene={eigene} andere={andere} onEigene={() => setEigene((v) => !v)} onAndere={() => setAndere((v) => !v)} disabled={laeuft} />
        <p className="text-[12.5px] leading-snug text-ink-muted">{ERKLAERUNG}</p>
        {fehler ? <p className="text-[13px] text-crit-fg">{fehler}</p> : null}
        <button
          type="button"
          onClick={() => speichern(eigene, andere)}
          disabled={laeuft}
          className="h-12 w-full rounded-full bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-60"
          data-team-speichern
        >
          Speichern
        </button>
        <button
          type="button"
          onClick={() => speichern(false, false)}
          disabled={laeuft}
          className="h-11 w-full rounded-full border border-ink/[0.12] text-[14.5px] font-semibold disabled:opacity-60"
          data-team-niemand
        >
          Niemandem zeigen
        </button>
        <p className="text-center text-[12px] text-ink-faint">Änderbar unter Einstellungen → Was Kollegen sehen</p>
      </div>
    </Blatt>
  );
}

/** Unter „Was Kollegen sehen“: die eigene Wahl, sofort gespeichert. */
export function TeamSichtbarkeitKarte() {
  const { stand, setStand } = useTeamSichtbarkeit();
  const [fehler, setFehler] = useState<string | null>(null);
  if (!stand || stand.modus === null) return null;
  if (stand.modus === "alle") {
    return (
      <Gruppe titel="Name und Schichten">
        <Zeile titel="Dein Betrieb zeigt allen Kollegen Namen und Schichten" text="Ausgenommen sind nur Personen, die noch nicht angemeldet oder ausgeschieden sind." />
      </Gruppe>
    );
  }
  const umschalten = async (feld: "eigene" | "andere") => {
    const neu = { ...stand, [feld]: !stand[feld], gefragt: true };
    setStand(neu);
    setFehler(null);
    try {
      await setzeTeamSichtbarkeit({ eigene: neu.eigene, andere: neu.andere });
      window.dispatchEvent(new Event("team-sichtbarkeit"));
    } catch (err) {
      setStand(stand);
      setFehler(err instanceof Error ? err.message : "Das hat nicht geklappt.");
    }
  };
  return (
    <section className="space-y-2" data-team-karte>
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Wer sieht meinen Namen und meine Schichten?</h2>
      <Wahl eigene={stand.eigene} andere={stand.andere} onEigene={() => umschalten("eigene")} onAndere={() => umschalten("andere")} />
      <p className="px-1 text-[12.5px] leading-snug text-ink-muted">{ERKLAERUNG}</p>
      {fehler ? <p className="px-1 text-[13px] text-crit-fg">{fehler}</p> : null}
    </section>
  );
}

/** Unter „Aufs Handy“: Mitteilungen ohne Inhalt auf dem Sperrbildschirm. */
export function PushOhneInhaltZeile() {
  const { stand, setStand } = useTeamSichtbarkeit();
  if (!stand || stand.modus === null) return null;
  return (
    <Gruppe titel="Sperrbildschirm">
      <Zeile
        inline
        titel="Ohne Inhalt anzeigen"
        text="Statt Namen und Details steht dort nur „Neue Mitteilung“. Den Inhalt siehst du in der App."
        rechts={
          <Schalter
            an={stand.pushOhneInhalt}
            label="Mitteilungen ohne Inhalt auf dem Sperrbildschirm"
            onClick={() => {
              const an = !stand.pushOhneInhalt;
              setStand({ ...stand, pushOhneInhalt: an });
              setzeTeamSichtbarkeit({ pushOhneInhalt: an }).catch(() => setStand(stand));
            }}
          />
        }
      />
    </Gruppe>
  );
}

/** Für die Administration: Schalter des Betriebs und Stand im Team (nur Zahlen). */
export function TeamModusKarte() {
  const { company } = useSession();
  const { stand, setStand } = useTeamSichtbarkeit();
  const [zahlen, setZahlen] = useState<TeamZahlen | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    ladeTeamZahlen().then(setZahlen);
  }, []);
  if (!stand) return <p className="text-[14px] text-ink-muted">wird geladen …</p>;
  if (stand.modus === null) return <p className="text-[14px] text-ink-muted">Diese Einstellung ist bald verfügbar.</p>;
  const waehle = async (modus: TeamModus) => {
    if (modus === stand.modus) return;
    const alt = stand;
    setStand({ ...stand, modus });
    setFehler(null);
    try {
      await setzeTeamModus(company.id, modus);
    } catch (err) {
      setStand(alt);
      setFehler(err instanceof Error ? err.message : "Das hat nicht geklappt.");
    }
  };
  return (
    <div className="space-y-5" data-team-modus>
      <Gruppe
        titel="Wer sieht Namen im Plan?"
        hinweis="Leitung und Administration sehen immer alle Namen. Wer noch nicht angemeldet oder ausgeschieden ist, erscheint für Mitarbeitende immer ohne Namen."
      >
        <WahlZeile
          aktiv={stand.modus === "zustimmung"}
          titel="Nur mit Zustimmung"
          text="Jede Person entscheidet selbst – für die eigene und die anderen Schichtgruppen."
          onClick={() => waehle("zustimmung")}
        />
        <WahlZeile aktiv={stand.modus === "alle"} titel="Alle sehen alle" text="Wie bisher: alle angemeldeten Kollegen mit Namen." onClick={() => waehle("alle")} />
      </Gruppe>
      {fehler ? <p className="px-1 text-[13px] text-crit-fg">{fehler}</p> : null}
      {zahlen ? (
        <Gruppe titel="Stand im Team" hinweis="Nur Zahlen – wer was gewählt hat, zeigt ShiftNexo bewusst nicht.">
          <Zeile inline titel="Sichtbar für die eigene Gruppe" rechts={<b className="tnum">{zahlen.eigene}</b>} />
          <Zeile inline titel="Sichtbar für andere Gruppen" rechts={<b className="tnum">{zahlen.andere}</b>} />
          <Zeile inline titel="Für niemanden sichtbar" rechts={<b className="tnum">{zahlen.abgelehnt}</b>} />
          <Zeile inline titel="Noch nicht gefragt" rechts={<b className="tnum">{zahlen.offen}</b>} />
          <Zeile inline titel="Noch nicht angemeldet" rechts={<b className="tnum">{zahlen.nichtAngemeldet}</b>} />
        </Gruppe>
      ) : null}
    </div>
  );
}
