"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Gruppe, Zeile } from "./gruppe";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { fetchMailPostausgang, type MailPostausgang } from "@/lib/data/notifications";
import { formatDE } from "@/lib/dates";

/**
 * Zeigt, ob der eigene Mailversand läuft.
 *
 * Ob in Supabase SMTP hinterlegt ist, lässt sich über die Schnittstelle
 * nicht abfragen. Wohl aber, ob Nachrichten liegen bleiben: jede E-Mail
 * geht zuerst in den Postausgang (`email_outbox`) und wird von dort von
 * der Edge Function `mail-versand` abgeholt. Stauen sich offene Zeilen,
 * ist der Versand nicht eingerichtet – das ist eine verlässlichere Aussage
 * als ein fest eingebauter Hinweistext.
 */
export function MailDeliveryCard() {
  const [stand, setStand] = useState<MailPostausgang | null>(null);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    fetchMailPostausgang()
      .then(setStand)
      .catch(() => setStand(null))
      .finally(() => setGeladen(true));
  }, []);

  const staut = (stand?.offen ?? 0) > 0;
  const laeuft = !staut && (stand?.gesendet ?? 0) > 0;

  return (
    <Gruppe titel="Mailversand">
      <Zeile
        titel="Postausgang"
        text="Benachrichtigungen an die Schichtleitung gehen über einen Postausgang."
        inline
        rechts={
          geladen ? (
            <Badge tone={laeuft ? "ok" : staut ? "warn" : "neutral"}>
              {laeuft ? "läuft" : staut ? "steht" : "noch nichts versendet"}
            </Badge>
          ) : null
        }
      />
      {!geladen ? (
        <p className="px-4 py-3.5 text-sm text-ink-muted sm:px-5">wird geladen …</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 px-4 py-3.5 sm:px-5">
            <Zahl label="wartet" wert={stand?.offen ?? 0} betont={staut} />
            <Zahl label="versendet" wert={stand?.gesendet ?? 0} />
            <Zahl label="gescheitert" wert={stand?.fehler ?? 0} betont={(stand?.fehler ?? 0) > 0} />
          </div>

          {stand?.letzterVersand || stand?.letzterFehler || staut ? (
            <div className="space-y-2 px-4 py-3.5 sm:px-5">
              {stand?.letzterVersand ? (
                <p className="text-[13px] text-ink-muted">Zuletzt versendet am {formatDE(stand.letzterVersand.slice(0, 10))}.</p>
              ) : null}
              {stand?.letzterFehler ? <Alert tone="error">Letzter Fehler: {stand.letzterFehler}</Alert> : null}
              {staut ? (
                <Alert tone="warning">
                  {stand?.offen === 1
                    ? "Eine Nachricht wartet im Postausgang."
                    : `${stand?.offen} Nachrichten warten im Postausgang.`}{" "}
                  Solange kein eigener SMTP-Versand eingerichtet ist, bleiben sie dort stehen – verloren geht nichts.
                </Alert>
              ) : null}
            </div>
          ) : null}

          <details className="group px-4 py-3.5 sm:px-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium [&::-webkit-details-marker]:hidden">
              Einrichtung des eigenen Versands
              <ChevronDown className="h-4 w-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3">
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Der eingebaute Versand von Supabase ist nur zum Ausprobieren gedacht – wenige Mails pro Stunde, je nach
                Projekt nur an Adressen des Projektteams. Für den Betrieb braucht es einen eigenen SMTP-Zugang.
              </p>
              <ol className="mt-2 ml-4 list-decimal space-y-1 text-[13px] leading-relaxed text-ink-muted marker:text-ink-faint">
                <li>
                  Supabase → Authentication → Emails → SMTP Settings: eigenen Zugang hinterlegen (gilt für Bestätigungs-
                  und Einladungsmails).
                </li>
                <li>
                  Supabase → Edge Functions → Secrets: <Code>SMTP_HOST</Code>, <Code>SMTP_PORT</Code>,{" "}
                  <Code>SMTP_USER</Code>, <Code>SMTP_PASS</Code> und <Code>SMTP_FROM</Code> setzen (gilt für diese
                  Benachrichtigungen).
                </li>
                <li>
                  Supabase → Integrations → Cron: die Funktion <Code>mail-versand</Code> minütlich aufrufen lassen.
                </li>
              </ol>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                Die vollständige Anleitung samt Textvorlagen steht im Projekt unter{" "}
                <Code>supabase/email-templates/README.md</Code>.
              </p>
            </div>
          </details>
        </>
      )}
    </Gruppe>
  );
}

function Zahl({ label, wert, betont }: { label: string; wert: number; betont?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-muted px-3 py-2.5">
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p className={`tnum mt-0.5 text-lg font-semibold ${betont ? "text-warn-fg" : ""}`}>
        {wert}
      </p>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <code className="rounded bg-surface px-1 py-0.5 text-[12px] text-ink">{children}</code>
  );
}
