"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/context/session";
import { fetchSetupState, DataError, type SetupState } from "@/lib/data/setup";
import { completeSetup } from "@/lib/auth/setup-actions";
import { SchrittProfil } from "./schritt-profil";
import { SchrittBundesland } from "./schritt-bundesland";
import { SchrittSchichtsystem } from "./schritt-schichtsystem";
import { SchrittMitarbeiter } from "./schritt-mitarbeiter";
import { cn } from "@/lib/utils";

const SCHRITTE = [
  { nr: 1, titel: "Deine Angaben", kurz: "Urlaub, Schicht, Abteilung" },
  { nr: 2, titel: "Feiertage", kurz: "Bundesland" },
  { nr: 3, titel: "Schichtsystem", kurz: "Muster und Gruppen" },
  { nr: 4, titel: "Mitarbeiter", kurz: "Team anlegen" },
];

const LETZTER_SCHRITT = SCHRITTE.length;

/**
 * Geführte Ersteinrichtung für neu registrierte Unternehmen.
 *
 * Der Assistent richtet nichts Eigenes ein – er führt durch dieselben
 * Funktionen, die es unter Schichten, Regeln und Mitarbeiter schon gibt.
 * Sein Zweck ist die Reihenfolge: ein frisch registriertes Unternehmen hat
 * bewusst keine Vorgabewerte, deshalb stehen die eigenen Angaben am
 * Anfang. Danach das Gerüst – ohne Feiertage rechnet die Urlaubsberechnung
 * falsch, ohne Schichtmuster steht der Plan leer, und ohne Mitarbeiter
 * gibt es nichts zu planen.
 *
 * Er lässt sich jederzeit überspringen und später über die Einstellungen
 * erneut öffnen. Bestehende Unternehmen, die alles von Hand eingerichtet
 * haben, gelten als fertig und werden nicht hineingezwungen.
 */
export default function EinrichtungPage() {
  const router = useRouter();
  const { mode, role, company } = useSession();
  const [stand, setStand] = useState<SetupState | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [schritt, setSchritt] = useState(1);
  const [abschlussMeldung, setAbschlussMeldung] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const laden = useCallback(async () => {
    try {
      setStand(await fetchSetupState());
      setFehler(null);
    } catch (caught) {
      setStand(null);
      setFehler(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    } finally {
      setGeladen(true);
    }
  }, []);

  useEffect(() => {
    if (mode !== "live" || role !== "admin") {
      setGeladen(true);
      return;
    }
    void laden();
  }, [mode, role, laden]);

  if (mode !== "live") {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Verwaltung" title="Einrichtung" />
        <Alert tone="info">
          Die Einrichtung gibt es nur im Live-Modus – im Demo-Modus sind Feiertage,
          Schichtmuster und Mitarbeiter bereits als Beispieldaten hinterlegt.
        </Alert>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Verwaltung" title="Einrichtung" />
        <Alert tone="warning">
          Die Einrichtung des Unternehmens nimmt die Administration vor.
        </Alert>
      </div>
    );
  }

  function abschliessen() {
    startTransition(async () => {
      const result = await completeSetup(true);
      if (result.error) {
        setFehler(result.error);
        return;
      }
      setAbschlussMeldung(result.success ?? null);
      router.push("/dashboard");
      router.refresh();
    });
  }

  // Drei Fälle, nicht zwei: offen, abgeschlossen – und "unbekannt", wenn
  // der Stand nicht geladen werden konnte. Ohne diese Unterscheidung
  // behauptet die Seite bei einem Ladefehler, die Einrichtung sei fertig.
  const abgeschlossen = stand !== null && stand.abgeschlossenAm !== null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Verwaltung"
        title={`${company.name} einrichten`}
        description="Vier Schritte, danach ist die Anwendung einsatzbereit. Du kannst jederzeit abbrechen und später hier weitermachen."
        action={
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            Später
          </Button>
        }
      />

      {fehler ? <Alert tone="error">{fehler}</Alert> : null}
      {abschlussMeldung ? <Alert tone="success">{abschlussMeldung}</Alert> : null}

      {geladen && abgeschlossen ? (
        <Alert tone="info">
          Die Einrichtung dieses Unternehmens ist bereits abgeschlossen
          {stand?.abgeschlossenAm
            ? ` (${new Date(stand.abgeschlossenAm).toLocaleDateString("de-DE")})`
            : ""}
          . Du kannst die Schritte trotzdem durchgehen – geändert wird nur, was du
          tatsächlich speicherst.
        </Alert>
      ) : null}

      <Fortschritt aktiv={schritt} stand={stand} onWechsel={setSchritt} />

      {!geladen ? (
        <Card>
          <CardBody>
            <p className="text-sm text-ink-muted">wird geladen …</p>
          </CardBody>
        </Card>
      ) : schritt === 1 ? (
        <SchrittProfil onFertig={laden} />
      ) : schritt === 2 ? (
        <SchrittBundesland stand={stand} onFertig={laden} />
      ) : schritt === 3 ? (
        <SchrittSchichtsystem stand={stand} onFertig={laden} />
      ) : (
        <SchrittMitarbeiter stand={stand} onFertig={laden} />
      )}

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="secondary"
            disabled={schritt === 1}
            onClick={() => setSchritt((s) => Math.max(1, s - 1))}
          >
            Zurück
          </Button>

          {schritt < LETZTER_SCHRITT ? (
            <Button onClick={() => setSchritt((s) => Math.min(LETZTER_SCHRITT, s + 1))}>
              Weiter
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={abschliessen} disabled={pending}>
              {pending ? "Wird gespeichert …" : "Einrichtung abschließen"}
            </Button>
          )}
        </CardBody>
      </Card>

      <p className="text-center text-[12px] text-ink-faint">
        Alles hier lässt sich später auch einzeln ändern – unter{" "}
        <Link href="/verwaltung?bereich=regeln" className="hover:underline">
          Regeln
        </Link>
        ,{" "}
        <Link href="/verwaltung?bereich=schichten" className="hover:underline">
          Schichten
        </Link>{" "}
        und{" "}
        <Link href="/verwaltung?bereich=mitarbeiter" className="hover:underline">
          Mitarbeiter
        </Link>
        .
      </p>
    </div>
  );
}

/** Kopfzeile mit den vier Schritten und ihrem Stand. */
function Fortschritt({
  aktiv,
  stand,
  onWechsel,
}: {
  aktiv: number;
  stand: SetupState | null;
  onWechsel: (nr: number) => void;
}) {
  const erledigt: Record<number, boolean> = {
    // Eigener Vermerk in der Datenbank statt Raten anhand der Werte:
    // „0 Urlaubstage" ist eine gültige Antwort, keine fehlende.
    1: Boolean(stand?.eigenesProfilBestaetigt),
    2: (stand?.feiertage ?? 0) > 0,
    3: Boolean(stand?.musterVorhanden),
    4: (stand?.mitarbeiter ?? 0) > 1,
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {SCHRITTE.map((s) => {
        const ist = aktiv === s.nr;
        const fertig = erledigt[s.nr];
        return (
          <button
            key={s.nr}
            type="button"
            onClick={() => onWechsel(s.nr)}
            className={cn(
              "flex items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors",
              ist ? "border-brand-500 bg-brand-50" : "border-line bg-surface hover:bg-surface-muted",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                fertig
                  ? "bg-ok-bg text-ok-fg"
                  : ist
                    ? "bg-brand-500 text-white"
                    : "bg-surface-muted text-ink-muted",
              )}
            >
              {fertig ? <Check className="h-4 w-4" strokeWidth={2.5} /> : s.nr}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate text-sm font-medium",
                  ist ? "text-brand-700" : "text-ink",
                )}
              >
                {s.titel}
              </span>
              <span className="block truncate text-[12px] text-ink-muted">{s.kurz}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
