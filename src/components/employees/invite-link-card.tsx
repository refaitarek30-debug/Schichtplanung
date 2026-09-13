"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";

/**
 * Zeigt das Ergebnis einer Einladung – und vor allem den Link.
 *
 * Der eingebaute Postversand von Supabase ist nur zum Ausprobieren gedacht:
 * wenige Mails pro Stunde, und je nach Projekt gehen sie ausschließlich an
 * Adressen des Projektteams. Deshalb wird der Zugang hier nicht mehr allein
 * per Mail zugestellt. Der Link steht offen da, lässt sich mit einem Klick
 * kopieren und über den gewohnten Weg weitergeben.
 */
export function InviteLinkCard({
  message,
  link,
  tone = "ok",
  onClose,
}: {
  message: string;
  link?: string;
  tone?: "ok" | "error";
  onClose: () => void;
}) {
  const [kopiert, setKopiert] = useState(false);

  async function kopieren() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Ohne Zwischenablage (altes Handy, kein HTTPS) bleibt der Link
      // im Textfeld markierbar – deshalb hier kein Fehler.
      return;
    }
    setKopiert(true);
    window.setTimeout(() => setKopiert(false), 2000);
  }

  return (
    <Card className={tone === "error" ? "border-crit-dot/40" : "border-ok-dot/40"}>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <p
            className={`flex-1 text-sm ${tone === "error" ? "text-crit-fg" : "text-ink"}`}
          >
            {message}
          </p>
          <button
            onClick={onClose}
            aria-label="Hinweis schließen"
            className="rounded-lg p-1 text-ink-faint hover:bg-surface-sunken"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {link ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Einladungslink"
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface-sunken px-3 py-2.5 font-mono text-[12px]"
              />
              <button
                onClick={kopieren}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
              >
                {kopiert ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {kopiert ? "Kopiert" : "Link kopieren"}
              </button>
            </div>
            <p className="text-[12px] leading-snug text-ink-muted">
              Der Link gilt 24 Stunden und richtet genau diesen einen Zugang ein.
              Nur an die betreffende Person weitergeben – wer ihn hat, kommt in
              das Konto. Nach dem Öffnen wird zuerst ein eigenes Passwort
              gesetzt.
            </p>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}
