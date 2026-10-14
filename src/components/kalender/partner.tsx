"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Share2 } from "lucide-react";
import { formatDE, formatZeitpunkt } from "@/lib/dates";
import {
  beendePartnerLink,
  erstellePartnerLink,
  fetchPartnerLinkStatus,
  type PartnerCode,
  type PartnerLinkStatus,
} from "@/lib/data/partner";
import { cn } from "@/lib/utils";

/**
 * Arbeitstage des Partners im Kalender.
 *
 * Gespeichert in der Datenbank (0138_kalender_partner.sql), damit der
 * Partner sie über seinen Einladungslink selbst eintragen kann und der
 * Inhaber sie sieht. Lesen und schreiben können nur diese beiden – auch
 * die Firma nicht.
 */

export type PartnerSchicht = PartnerCode;

export const PARTNER_SCHICHTEN: { code: PartnerSchicht; text: string; lang: string }[] = [
  { code: "F", text: "Früh", lang: "Frühschicht" },
  { code: "S", text: "Spät", lang: "Spätschicht" },
  { code: "N", text: "Nacht", lang: "Nachtschicht" },
  { code: "T", text: "Arbeit", lang: "Arbeitstag" },
  { code: "X", text: "Frei", lang: "Frei" },
];

export function partnerText(code: PartnerSchicht, lang = false): string {
  const s = PARTNER_SCHICHTEN.find((x) => x.code === code);
  return (lang ? s?.lang : s?.text) ?? code;
}

/** Umriss in der Farbe der Schicht – gefüllt sind nur die eigenen. */
export const PARTNER_FARBE: Record<PartnerSchicht, string> = {
  F: "ring-shift-frueh-ink/70 text-shift-frueh-ink",
  S: "ring-shift-spaet-ink/70 text-shift-spaet-ink",
  N: "ring-shift-nacht-ink/70 text-shift-nacht-ink",
  T: "ring-brand-600/70 text-brand-700",
  X: "ring-line text-ink-faint",
};

/** Gefüllt – für die eigenen Schichten in der Partneransicht und die Auswahl. */
export const VOLL_FARBE: Record<PartnerSchicht, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
  T: "bg-brand-100 text-brand-700",
  X: "bg-surface-sunken text-ink-muted",
};

/**
 * Früher lagen die Partnertage nur im Browser. Was dort noch steht, wird
 * einmal in die Datenbank übernommen und danach gelöscht.
 */
export function alteLokalePartnerTage(benutzer: string): Record<string, PartnerSchicht> | null {
  try {
    const roh = window.localStorage.getItem(`schichtplan.partner.${benutzer}`);
    if (!roh) return null;
    const daten = JSON.parse(roh) as Record<string, unknown>;
    const gueltig = new Set(PARTNER_SCHICHTEN.map((s) => s.code));
    const tage: Record<string, PartnerSchicht> = {};
    for (const [tag, code] of Object.entries(daten ?? {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(tag) && gueltig.has(code as PartnerSchicht)) {
        tage[tag] = code as PartnerSchicht;
      }
    }
    return tage;
  } catch {
    return null;
  }
}

export function vergissLokalePartnerTage(benutzer: string) {
  try {
    window.localStorage.removeItem(`schichtplan.partner.${benutzer}`);
  } catch {
    // egal – dann wird beim nächsten Mal noch einmal übernommen (idempotent)
  }
}

const ANZAHL = [1, 3, 5, 7, 14];

function Blatt({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">{children}</div>;
}

export function PartnerBlatt({
  datum,
  aktuell,
  hinweis,
  onWahl,
  onClose,
  onEinladen,
}: {
  datum: string;
  aktuell: PartnerSchicht | null;
  /** Zeile unter der Auswahl. */
  hinweis: string;
  onWahl: (code: PartnerSchicht | null, anzahl: number) => void;
  onClose: () => void;
  /** Nur beim Inhaber: Verweis auf die Einladung. */
  onEinladen?: () => void;
}) {
  const [anzahl, setAnzahl] = useState(1);

  return createPortal(
    <Blatt>
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Arbeitstag des Partners"
        className="relative w-full max-w-lg overflow-hidden rounded-t-3xl bg-surface shadow-pop lg:rounded-3xl"
      >
        <div className="flex items-baseline justify-between bg-surface-sunken px-5 py-4">
          <span className="text-[17px] font-semibold">{formatDE(datum)}</span>
          <span className="text-[15px] text-ink-muted">Partner</span>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-5 gap-2">
            {PARTNER_SCHICHTEN.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => onWahl(s.code, anzahl)}
                aria-pressed={aktuell === s.code}
                className={cn(
                  "rounded-xl py-4 text-[14px] font-semibold",
                  VOLL_FARBE[s.code],
                  aktuell === s.code && "ring-2 ring-brand-500 ring-offset-2 ring-offset-surface",
                )}
              >
                {s.text}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Für wie viele Tage">
            <span className="mr-1 text-[15px]">Für</span>
            {ANZAHL.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAnzahl(n)}
                aria-pressed={anzahl === n}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[14px] font-semibold",
                  anzahl === n ? "bg-brand-500 text-white" : "bg-surface-muted text-ink-muted",
                )}
              >
                {n === 1 ? "1 Tag" : `${n} Tage`}
              </button>
            ))}
          </div>

          <p className="text-[12px] text-ink-faint">{hinweis}</p>
          {onEinladen ? (
            <button
              type="button"
              onClick={onEinladen}
              className="text-[14px] font-semibold text-brand-600 underline"
            >
              Partner einladen, damit er selbst einträgt
            </button>
          ) : null}
        </div>

        <div className="flex items-center border-t border-line pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={() => onWahl(null, anzahl)}
            className="h-14 flex-1 text-[16px] font-semibold text-crit-fg"
          >
            Entfernen
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-14 flex-1 text-[16px] font-semibold text-ink-muted"
          >
            Schließen
          </button>
        </div>
      </div>
    </Blatt>,
    document.body,
  );
}

/** Einladungslink erstellen, teilen, beenden. */
export function PartnerEinladen({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<PartnerLinkStatus | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const [sicherBeenden, setSicherBeenden] = useState(false);

  useEffect(() => {
    let aus = false;
    fetchPartnerLinkStatus()
      .then((s) => !aus && setStatus(s))
      .catch((e: unknown) => !aus && setFehler(e instanceof Error ? e.message : "Fehler beim Laden."));
    return () => {
      aus = true;
    };
  }, []);

  async function erstellen() {
    setLaeuft(true);
    setFehler(null);
    try {
      const schluessel = await erstellePartnerLink();
      setLink(`${window.location.origin}/partner/${schluessel}`);
      setStatus(await fetchPartnerLinkStatus());
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Link konnte nicht erstellt werden.");
    } finally {
      setLaeuft(false);
    }
  }

  async function beenden() {
    setLaeuft(true);
    setFehler(null);
    try {
      await beendePartnerLink();
      setLink(null);
      setSicherBeenden(false);
      setStatus(await fetchPartnerLinkStatus());
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Zugang konnte nicht beendet werden.");
    } finally {
      setLaeuft(false);
    }
  }

  async function kopieren() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    } catch {
      setFehler("Kopieren ging nicht – bitte den Link oben markieren und kopieren.");
    }
  }

  async function teilen() {
    if (!link) return;
    try {
      await navigator.share({ title: "Mein Schichtplan", text: "Hier siehst du meinen Schichtplan und kannst deine Arbeitstage eintragen:", url: link });
    } catch {
      // abgebrochen – nichts zu tun
    }
  }

  const kannTeilen = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return createPortal(
    <Blatt>
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Partner einladen"
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface shadow-pop lg:rounded-3xl"
      >
        <div className="bg-surface-sunken px-5 py-4">
          <p className="text-[17px] font-semibold">Partner einladen</p>
        </div>

        <div className="space-y-4 px-5 py-4 text-[14px] leading-relaxed">
          <ul className="space-y-1.5 text-ink-muted">
            <li>✓ Dein Partner sieht deinen Schichtplan – Früh, Spät, Nacht, Frei.</li>
            <li>✓ Er trägt seine Arbeitstage selbst ein, du siehst sie hier.</li>
            <li>✗ Urlaub, Krankheit, Kollegen und alles andere sieht er nicht.</li>
          </ul>

          {fehler ? <p className="rounded-xl bg-crit-bg px-3 py-2 text-crit-fg">{fehler}</p> : null}

          {link ? (
            <div className="space-y-2 rounded-2xl border border-line p-3">
              <p className="text-[13px] font-semibold">Dein Link – nur jetzt sichtbar:</p>
              <p className="select-all break-all rounded-lg bg-surface-muted px-3 py-2 font-mono text-[12px]">{link}</p>
              <div className="flex gap-2">
                {kannTeilen ? (
                  <button
                    type="button"
                    onClick={teilen}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 font-semibold text-white"
                  >
                    <Share2 className="h-4 w-4" /> Teilen
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={kopieren}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-surface-muted font-semibold text-brand-600"
                >
                  {kopiert ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {kopiert ? "Kopiert" : "Kopieren"}
                </button>
              </div>
              <p className="text-[12px] text-ink-faint">
                Wer den Link hat, sieht deinen Plan. Gib ihn nur deinem Partner.
              </p>
            </div>
          ) : status === null && !fehler ? (
            <p className="text-ink-muted">wird geladen …</p>
          ) : status?.aktiv ? (
            <div className="space-y-1 rounded-2xl border border-line p-3">
              <p className="font-semibold">Dein Partner hat Zugang.</p>
              <p className="text-[13px] text-ink-muted">
                Link erstellt am {status.erstelltAm ? formatZeitpunkt(status.erstelltAm) : "–"}
                {status.zuletztGenutzt
                  ? ` · zuletzt geöffnet am ${formatZeitpunkt(status.zuletztGenutzt)}`
                  : " · noch nicht geöffnet"}
              </p>
            </div>
          ) : null}

          {!link && status ? (
            <button
              type="button"
              disabled={laeuft}
              onClick={erstellen}
              className="h-12 w-full rounded-xl bg-brand-500 text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {status.aktiv ? "Neuen Link erstellen" : "Einladungslink erstellen"}
            </button>
          ) : null}
          {!link && status?.aktiv ? (
            <p className="text-[12px] text-ink-faint">
              Ein neuer Link ersetzt den alten – der alte funktioniert dann nicht mehr.
            </p>
          ) : null}

          {status?.aktiv ? (
            sicherBeenden ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={beenden}
                  className="h-11 flex-1 rounded-xl bg-crit-bg font-semibold text-crit-fg"
                >
                  Ja, Zugang beenden
                </button>
                <button
                  type="button"
                  onClick={() => setSicherBeenden(false)}
                  className="h-11 flex-1 rounded-xl bg-surface-muted font-semibold text-ink-muted"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSicherBeenden(true)}
                className="text-[14px] font-semibold text-crit-fg"
              >
                Zugang beenden
              </button>
            )
          ) : null}
        </div>

        <div className="border-t border-line pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={onClose}
            className="h-14 w-full text-[16px] font-semibold text-ink-muted"
          >
            Schließen
          </button>
        </div>
      </div>
    </Blatt>,
    document.body,
  );
}
