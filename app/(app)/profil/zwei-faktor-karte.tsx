"use client";

import { useEffect, useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { meinZweiFaktorStatus, zweiFaktorAusschalten } from "@/lib/auth/zwei-faktor-actions";

/** Zwei-Faktor-Anmeldung im Profil: Stand, einrichten, ausschalten (Migration 0219). */
export function ZweiFaktorKarte() {
  const [status, setStatus] = useState<{ aktiv: boolean; pflicht: boolean } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  useEffect(() => {
    let weg = false;
    void meinZweiFaktorStatus().then((s) => {
      if (!weg) setStatus(s);
    });
    return () => {
      weg = true;
    };
  }, []);

  function ausschalten() {
    setFehler(null);
    starte(async () => {
      const r = await zweiFaktorAusschalten();
      if (r.error) setFehler(r.error);
      else setStatus((s) => (s ? { ...s, aktiv: false } : s));
    });
  }

  return (
    <div data-zwei-faktor-karte>
      <Card className="h-fit">
        <CardHeader title="Zwei-Faktor-Anmeldung" />
        <CardBody className="space-y-3">
          {!status ? (
            <p className="text-sm text-ink-muted">Wird geladen …</p>
          ) : status.aktiv ? (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold text-ok-fg">
                <ShieldCheck className="h-4 w-4" /> Eingeschaltet
              </p>
              <p className="text-[13px] text-ink-muted">
                Nach dem Passwort fragt ShiftNexo den Code aus deiner Authenticator-App ab. Neues Handy? Die
                Administration kann die Zwei-Faktor-Anmeldung zurücksetzen.
              </p>
              {status.pflicht ? (
                <p className="text-[12.5px] text-ink-faint">Für Administration und Schichtleitung ist sie Pflicht.</p>
              ) : (
                <Button variant="secondary" disabled={laeuft} onClick={ausschalten}>
                  Ausschalten
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-[13px] text-ink-muted">
                Mehr Schutz: Wer dein Passwort kennt, kommt ohne dein Handy trotzdem nicht hinein. Du brauchst eine
                Authenticator-App (zum Beispiel Microsoft oder Google Authenticator).
              </p>
              <a
                href="/zwei-faktor/einrichten?weiter=/profil"
                className="inline-flex rounded-xl bg-brand-500 px-3.5 py-2.5 text-sm font-semibold text-white"
              >
                Jetzt einrichten
              </a>
            </>
          )}
          {fehler ? <p className="text-sm text-crit-fg">{fehler}</p> : null}
        </CardBody>
      </Card>
    </div>
  );
}
