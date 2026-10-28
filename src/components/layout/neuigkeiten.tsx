"use client";

import { useState, useSyncExternalStore } from "react";
import { Lightbulb } from "lucide-react";
import { Blatt } from "@/components/privat/blatt";
import { useSession } from "@/context/session";
import { hatNeues, istNeu, neuigkeitDatum, neuigkeitenFuer, type Neuigkeit } from "@/lib/neuigkeiten";
import { cn } from "@/lib/utils";

/**
 * Glühbirne – nur auf der Startseite: leuchtet gelb, wenn es seit dem letzten
 * Öffnen etwas Neues gibt. Ein Tipp öffnet die Liste – danach ist sie
 * „gesehen“ und leuchtet nicht mehr, bleibt aber zum Nachlesen da.
 *
 * „Gesehen“ steht im Konto und zusätzlich auf dem Gerät. Es gilt der spätere
 * der beiden Zeitpunkte – so leuchtet sie auch dann nicht wieder auf, wenn
 * die App einen älteren Stand der Seite zeigt.
 *
 * `rund` für die Glas-Kopfzeilen (Handy), sonst als Knopf in der Kopfleiste.
 */

const LOKAL_EREIGNIS = "neuigkeiten-gesehen";
const lokalSchluessel = (wer: string) => `sp_neuigkeiten_gesehen:${wer}`;

/** Auf dem Gerät gemerkt; `undefined` solange die Seite noch vom Server kommt. */
function useLokalGesehen(wer: string): string | null | undefined {
  return useSyncExternalStore(
    (rueckruf) => {
      window.addEventListener("storage", rueckruf);
      window.addEventListener(LOKAL_EREIGNIS, rueckruf);
      return () => {
        window.removeEventListener("storage", rueckruf);
        window.removeEventListener(LOKAL_EREIGNIS, rueckruf);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(lokalSchluessel(wer));
      } catch {
        return null;
      }
    },
    () => undefined,
  );
}

function merkeLokal(wer: string, zeit: string) {
  try {
    window.localStorage.setItem(lokalSchluessel(wer), zeit);
  } catch {
    // ohne Speicher: dann zählt nur das Konto
  }
  window.dispatchEvent(new Event(LOKAL_EREIGNIS));
}

/** Der spätere von zwei Zeitpunkten (leer = nie). */
function spaeter(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * Zustand der Glühbirne für eine Person bzw. einen Bereich. Bis die Seite im
 * Browser läuft, leuchtet nichts – sonst blitzte sie kurz auf.
 */
export function useNeuigkeitenStand(
  wer: string,
  rolle: Parameters<typeof hatNeues>[0],
  gesehenKonto: string | null,
  imKontoMerken: () => void,
) {
  const lokal = useLokalGesehen(wer);
  const gesehen = spaeter(gesehenKonto, lokal ?? null);
  return {
    eintraege: neuigkeitenFuer(rolle),
    neu: lokal !== undefined && hatNeues(rolle, gesehen),
    gesehen,
    onGelesen: () => {
      merkeLokal(wer, new Date().toISOString());
      imKontoMerken();
    },
  };
}
interface KnopfProps {
  rund?: boolean;
  /** Nur zeigen, solange es Neues gibt – für volle Kopfzeilen (Kalender). */
  nurWennNeu?: boolean;
  className?: string;
}

export function NeuigkeitenKnopf(props: KnopfProps) {
  const { role, profile, neuigkeitenGesehen, neuigkeitenGelesen } = useSession();
  const stand = useNeuigkeitenStand(profile.id, role, neuigkeitenGesehen, neuigkeitenGelesen);
  return <NeuigkeitenBasis {...props} {...stand} />;
}

/** Dieselbe Glühbirne im Privatbereich – mit dessen eigenen Einträgen und eigenem „gelesen“. */
export function NeuigkeitenBasis({
  rund = false,
  nurWennNeu = false,
  className,
  eintraege,
  neu,
  gesehen: neuigkeitenGesehen,
  onGelesen: neuigkeitenGelesen,
}: KnopfProps & {
  eintraege: Neuigkeit[];
  neu: boolean;
  gesehen: string | null;
  onGelesen: () => void;
}) {
  const [offen, setOffen] = useState(false);
  // Was beim Öffnen neu war, bleibt in der Liste markiert, bis sie zugeht.
  const [gesehenVorher, setGesehenVorher] = useState<string | null>(null);
  if (eintraege.length === 0) return null;
  if (nurWennNeu && !neu && !offen) return null;

  function oeffnen() {
    setGesehenVorher(neuigkeitenGesehen);
    setOffen(true);
    if (neu) neuigkeitenGelesen();
  }

  return (
    <>
      <button
        type="button"
        onClick={oeffnen}
        data-neuigkeiten={neu ? "neu" : ""}
        aria-label={neu ? "Neuigkeiten – es gibt Neues" : "Neuigkeiten"}
        title="Neu bei ShiftNexo"
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full transition-colors",
          rund ? "glas h-10 w-10" : "h-9 w-9 hover:bg-surface-muted",
          neu && "neuigkeiten-leuchten",
          className,
        )}
      >
        <Lightbulb
          className={cn("h-[19px] w-[19px]", neu ? "text-[#e0a800]" : "text-ink-faint")}
          fill={neu ? "rgba(255, 214, 10, 0.45)" : "none"}
          strokeWidth={1.9}
        />
      </button>
      {offen ? (
        <Blatt titel="Neu bei ShiftNexo" onClose={() => setOffen(false)}>
          <p className="-mt-1 pb-3 text-[13.5px] text-ink-muted">Was sich zuletzt geändert hat.</p>
          <ul className="space-y-2">
            {eintraege.map((n) => {
              const frisch = istNeu(n, gesehenVorher);
              return (
                <li
                  key={n.zeit + n.titel}
                  className={cn("rounded-[16px] px-4 py-3", frisch ? "bg-[rgba(255,214,10,0.12)]" : "bg-ink/[0.04]")}
                >
                  <p className="flex items-center gap-2 text-[15px] font-semibold">
                    {n.titel}
                    {frisch ? (
                      <span className="rounded-full bg-[#ffd60a] px-1.5 py-px text-[10px] font-bold text-[#1b1600]">NEU</span>
                    ) : null}
                    <span className="ml-auto shrink-0 text-[12px] font-normal text-ink-faint">{neuigkeitDatum(n)}</span>
                  </p>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-ink-muted">{n.text}</p>
                </li>
              );
            })}
          </ul>
        </Blatt>
      ) : null}
    </>
  );
}
