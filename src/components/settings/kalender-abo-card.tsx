"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatZeitpunkt } from "@/lib/dates";
import { ABO_TEILE, type AboTeil } from "@/lib/abo/ics";
import { beendeAbo, erstelleAbo, fetchAboStatus, hatKalenderAbo, type AboStatus } from "@/lib/data/abo";

const TEILE: AboTeil[] = ["frueh", "spaet", "nacht", "frei", "termine"];

const webcal = (basis: string, teil: AboTeil) => (basis + ABO_TEILE[teil].datei).replace(/^https?:/, "webcal:");

/**
 * Kalender-Abo: der Plan im Kalender des Handys. Die Karte erscheint nur für
 * Personen, für die die Funktion freigeschaltet ist – sonst bleibt sie leer.
 */
export function KalenderAboCard() {
  const [frei, setFrei] = useState(false);
  const [status, setStatus] = useState<AboStatus | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const [beendenFrage, setBeendenFrage] = useState(false);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      if (!(await hatKalenderAbo())) return;
      try {
        const s = await fetchAboStatus();
        if (!aktiv) return;
        setStatus(s);
        setFrei(true);
      } catch {
        /* Karte bleibt weg, bis es wieder klappt */
      }
    })();
    return () => {
      aktiv = false;
    };
  }, []);

  if (!frei) return null;

  async function einrichten() {
    setLaeuft(true);
    setFehler(null);
    try {
      const schluessel = await erstelleAbo();
      setLink(`${window.location.origin}/abo/${schluessel}/`);
      setStatus(await fetchAboStatus());
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  }

  async function beenden() {
    setLaeuft(true);
    setFehler(null);
    try {
      await beendeAbo();
      setLink(null);
      setBeendenFrage(false);
      setStatus(await fetchAboStatus());
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  }

  async function kopieren() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link + ABO_TEILE.alles.datei);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    } catch {
      setFehler("Kopieren ging nicht – halte den Link gedrückt und kopiere ihn.");
    }
  }

  return (
    <Card>
      <CardHeader
        title="Kalender-Abo"
        hint="Dein Plan im Kalender deines Handys und als Widget – ohne die App zu öffnen."
      />
      <CardBody className="space-y-3 text-sm">
        {status?.aktiv ? (
          <p className="text-ink-muted">
            Eingerichtet am {formatZeitpunkt(status.erstelltAm ?? "")}
            {status.zuletztAbgerufen ? `, zuletzt abgerufen ${formatZeitpunkt(status.zuletztAbgerufen)}` : ", noch nicht abgerufen"}.
          </p>
        ) : (
          <p className="text-ink-muted">
            Schichten, Urlaub, Schulungen und deine eigenen Termine erscheinen im Kalender. Keine Kollegen, keine Gründe für Abwesenheit.
            Wer den Link kennt, sieht deinen Plan – gib ihn nicht weiter.
          </p>
        )}

        {link ? (
          <div className="space-y-3">
            <a
              href={webcal(link, "alles")}
              className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Zum Kalender hinzufügen
            </a>
            <p className="break-all rounded-lg bg-surface-muted p-2 font-mono text-xs text-ink-muted">
              {link + ABO_TEILE.alles.datei}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={kopieren}>
                {kopiert ? "Kopiert" : "Link kopieren"}
              </Button>
            </div>
            <p className="text-xs text-ink-muted">
              iPhone: Knopf antippen und „Abonnieren“ bestätigen. Google Kalender: im Browser „Weitere Kalender“ →
              „Per URL“ und den Link einfügen. Den Link siehst du nur jetzt – später kannst du einen neuen erzeugen.
            </p>

            <div className="space-y-2 rounded-xl border border-line p-3">
              <p className="font-medium">Lieber eigene Farben je Schicht?</p>
              <p className="text-xs text-ink-muted">
                Auf dem iPhone hat jeder Kalender genau eine Farbe. Statt des Kalenders oben abonnierst du dann diese
                einzeln – jeder bekommt seine Farbe (änderbar in der Kalender-App unter „Kalender“).
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEILE.map((teil) => (
                  <a
                    key={teil}
                    href={webcal(link, teil)}
                    className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 hover:bg-surface-muted"
                  >
                    <span
                      aria-hidden
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: ABO_TEILE[teil].farbe }}
                    />
                    {ABO_TEILE[teil].name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={einrichten} disabled={laeuft} variant={status?.aktiv ? "secondary" : "primary"}>
            {status?.aktiv ? "Neuen Link erzeugen" : "Abo einrichten"}
          </Button>
          {status?.aktiv && !beendenFrage ? (
            <Button variant="ghost" onClick={() => setBeendenFrage(true)} disabled={laeuft}>
              Beenden
            </Button>
          ) : null}
          {status?.aktiv && beendenFrage ? (
            <>
              <Button variant="danger" onClick={beenden} disabled={laeuft}>
                Wirklich beenden
              </Button>
              <Button variant="ghost" onClick={() => setBeendenFrage(false)}>
                Abbrechen
              </Button>
            </>
          ) : null}
        </div>
        {status?.aktiv ? (
          <p className="text-xs text-ink-muted">Ein neuer Link macht den alten sofort ungültig.</p>
        ) : null}
        {fehler ? <p className="text-crit-fg">{fehler}</p> : null}
      </CardBody>
    </Card>
  );
}
