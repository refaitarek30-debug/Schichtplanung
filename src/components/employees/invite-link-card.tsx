"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, X } from "lucide-react";
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
  name,
}: {
  message: string;
  link?: string;
  tone?: "ok" | "error";
  onClose: () => void;
  /** Für die Anrede im vorbereiteten WhatsApp-Text. Optional. */
  name?: string;
}) {
  const [kopiert, setKopiert] = useState(false);

  // Vorbereiteter Text. Wer ihn bekommt, soll wissen, worum es geht und
  // dass der Link nur für ihn ist – ein nackter Link in einer Nachricht
  // sieht aus wie etwas, das man besser nicht anklickt.
  const waText = [
    name ? `Hallo ${name},` : "Hallo,",
    "hier ist dein Zugang zur Schichtplanung.",
    "Der Link gilt 24 Stunden und ist nur für dich – beim Öffnen vergibst du dein eigenes Passwort.",
    link ?? "",
  ].join("\n\n");
  const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

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
                aria-label="Zugangslink"
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface-sunken px-3 py-2.5 font-mono text-[12px]"
              />
              <div className="flex gap-2">
                {/*
                  wa.me öffnet WhatsApp mit vorbereitetem Text und lässt den
                  Empfänger auswählen – am Handy die App, am Rechner WhatsApp
                  Web. Der Link wird dabei nicht an Dritte gegeben: die
                  Adresse wird nur lokal zusammengesetzt und geöffnet.
                */}
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-ok-dot px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 sm:flex-none"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <button
                  onClick={kopieren}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 sm:flex-none"
                >
                  {kopiert ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {kopiert ? "Kopiert" : "Kopieren"}
                </button>
              </div>
            </div>
            <p className="text-[12px] leading-snug text-ink-muted">
              Es wird keine Mail verschickt – dieser Link ist der Zugang.
              Er gilt 24 Stunden und richtet genau diesen einen Zugang ein.
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
