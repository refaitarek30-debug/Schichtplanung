"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Heart, Mail, MessageCircle, Share2, X } from "lucide-react";
import { formatZeitpunkt } from "@/lib/dates";
import {
  beendePartnerLink,
  erstelleEinladung,
  fetchEinladungStatus,
  setzeTermineTeilen,
  type EinladungStatus,
} from "@/lib/data/partner";
import { cn } from "@/lib/utils";

/**
 * Kalender teilen – Einladung des Partners in drei Schritten:
 *   1. „Kalender teilen“ (Übersicht, Stand der Einladung)
 *   2. „Was möchtest du teilen?“ (Schichtplan immer, eigene Termine wahlweise)
 *   3. „Sende deine Einladung“ (Nachrichten, WhatsApp, E-Mail, Teilen, QR-Code)
 *
 * Der Link wird nur in Schritt 3 angezeigt – gespeichert ist nur sein
 * Fingerabdruck. Eine neue Einladung ersetzt die alte.
 */

type Schritt = "start" | "auswahl" | "senden";

function Kopf({ titel, onClose }: { titel: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={onClose}
        aria-label="Schließen"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm ring-1 ring-line"
      >
        <X className="h-5 w-5" />
      </button>
      <h2 className="text-[22px] font-bold tracking-tight">{titel}</h2>
    </div>
  );
}

function Avatar({ text, name, farbe, gross }: { text: string; name: string; farbe: string; gross?: boolean }) {
  return (
    <div className="relative flex flex-col items-center">
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-surface-sunken font-bold text-ink ring-4 ring-surface-muted",
          gross ? "h-28 w-28 text-[40px]" : "h-24 w-24 text-[32px]",
        )}
      >
        {text}
      </span>
      <span className={cn("-mt-4 rounded-full px-3 py-1 text-[14px] font-bold text-white", farbe)}>{name}</span>
    </div>
  );
}

export function KalenderTeilen({ vorname, onClose }: { vorname: string; onClose: () => void }) {
  const [schritt, setSchritt] = useState<Schritt>("start");
  const [status, setStatus] = useState<EinladungStatus | null>(null);
  const [termineTeilen, setTermineTeilen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const [sicherBeenden, setSicherBeenden] = useState(false);

  useEffect(() => {
    let aus = false;
    fetchEinladungStatus()
      .then((s) => !aus && setStatus(s))
      .catch((e: unknown) => !aus && setFehler(e instanceof Error ? e.message : "Fehler beim Laden."));
    return () => {
      aus = true;
    };
  }, []);

  // QR-Code im Browser erzeugen – der Link verlässt das Gerät dafür nicht.
  useEffect(() => {
    if (!link) return;
    let aus = false;
    import("qrcode")
      .then((qrcode) => qrcode.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M" }))
      .then((svg) => !aus && setQr(svg))
      .catch(() => undefined);
    return () => {
      aus = true;
    };
  }, [link]);

  async function erstellen() {
    setLaeuft(true);
    setFehler(null);
    try {
      const schluessel = await erstelleEinladung(termineTeilen);
      setLink(`${window.location.origin}/partner/${schluessel}`);
      setSchritt("senden");
      setStatus(await fetchEinladungStatus());
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Einladung konnte nicht erstellt werden.");
    } finally {
      setLaeuft(false);
    }
  }

  async function beenden() {
    setLaeuft(true);
    setFehler(null);
    try {
      await beendePartnerLink();
      setSicherBeenden(false);
      setStatus(await fetchEinladungStatus());
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Zugang konnte nicht beendet werden.");
    } finally {
      setLaeuft(false);
    }
  }

  async function teilenUmschalten(an: boolean) {
    setFehler(null);
    // Sofort umschalten, bei Fehler zurück.
    setStatus((s) => (s ? { ...s, termineTeilen: an } : s));
    try {
      await setzeTermineTeilen(an);
    } catch (e) {
      setStatus((s) => (s ? { ...s, termineTeilen: !an } : s));
      setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden.");
    }
  }

  const nachricht = link
    ? `Hier ist mein Schichtplan – du kannst auch deine Arbeit, deinen Urlaub und Termine eintragen: ${link}`
    : "";

  async function kopieren() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    } catch {
      setFehler("Kopieren ging nicht – bitte den Link unten markieren und kopieren.");
    }
  }

  async function sonstige() {
    if (!link) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Mein Schichtplan", text: nachricht, url: link });
      } catch {
        // abgebrochen
      }
    } else {
      await kopieren();
    }
  }

  const fehlerBox = fehler ? (
    <p className="mx-4 mb-3 rounded-xl bg-crit-bg px-3 py-2 text-[14px] text-crit-fg">{fehler}</p>
  ) : null;

  let inhalt: React.ReactNode;

  if (schritt === "start") {
    inhalt = (
      <div className="flex min-h-full flex-col">
        <div className="flex justify-end px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm ring-1 ring-line"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-6 text-center">
          <div className="flex items-end gap-2">
            <Avatar text={(vorname || "D").slice(0, 1).toUpperCase()} name={vorname || "Du"} farbe="bg-brand-500" gross />
            <span className="mb-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-crit-dot shadow-sm">
              <Heart className="h-5 w-5 fill-current" />
            </span>
            <Avatar text="P" name="Partner" farbe="bg-shift-frueh-ink" />
          </div>
          <h2 className="mt-8 text-[30px] font-bold tracking-tight">Kalender teilen</h2>
          <p className="mt-3 max-w-xs text-[16px] leading-relaxed text-ink-muted">
            Teile deinen Schichtplan mit deinem Partner. Ihr seht beide eure Schichten, Urlaub und Termine.
          </p>

          {status?.aktiv ? (
            <div className="mt-6 w-full max-w-sm space-y-3 rounded-3xl bg-surface p-4 text-left shadow-sm ring-1 ring-line">
              <p className="text-[15px] font-semibold">Dein Partner hat Zugang</p>
              <p className="text-[13px] text-ink-muted">
                {status.zuletztGenutzt
                  ? `Zuletzt geöffnet am ${formatZeitpunkt(status.zuletztGenutzt)}`
                  : "Noch nicht geöffnet"}
              </p>
              <label className="flex items-center justify-between gap-3 border-t border-line pt-3 text-[15px]">
                Meine Termine teilen
                <input
                  type="checkbox"
                  checked={status.termineTeilen}
                  onChange={(e) => void teilenUmschalten(e.target.checked)}
                  className="h-6 w-6 accent-brand-500"
                />
              </label>
              {sicherBeenden ? (
                <div className="flex gap-2 border-t border-line pt-3">
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={beenden}
                    className="h-11 flex-1 rounded-xl bg-crit-bg font-semibold text-crit-fg"
                  >
                    Ja, beenden
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
                  className="border-t border-line pt-3 text-left text-[15px] font-semibold text-crit-fg"
                >
                  Zugang beenden
                </button>
              )}
            </div>
          ) : null}
        </div>
        {fehlerBox}
        <div className="px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!status}
            onClick={() => {
              setTermineTeilen(status?.termineTeilen ?? false);
              setSchritt("auswahl");
            }}
            className="h-14 w-full rounded-full bg-brand-500 text-[17px] font-semibold text-white disabled:opacity-60"
          >
            {status?.aktiv ? "Neue Einladung erstellen" : "Einladung erstellen"}
          </button>
          {status?.aktiv ? (
            <p className="mt-2 text-center text-[12px] text-ink-faint">
              Eine neue Einladung ersetzt die alte – der alte Link funktioniert dann nicht mehr.
            </p>
          ) : null}
        </div>
      </div>
    );
  } else if (schritt === "auswahl") {
    inhalt = (
      <div className="flex min-h-full flex-col">
        <Kopf titel="Neue Einladung" onClose={onClose} />
        <div className="flex-1 space-y-5 px-4 pt-2">
          <p className="text-[22px] font-bold">Was möchtest du teilen?</p>
          <div className="space-y-2">
            <p className="px-2 text-[15px] font-semibold text-ink-muted">Schichten</p>
            <div className="flex items-center justify-between rounded-full bg-surface px-5 py-4 ring-1 ring-line">
              <span className="text-[16px]">Mein Schichtplan</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-faint text-white">
                <Check className="h-5 w-5" />
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <p className="px-2 text-[15px] font-semibold text-ink-muted">Termine</p>
            <label className="flex cursor-pointer items-center justify-between rounded-full bg-surface px-5 py-4 ring-1 ring-line">
              <span className="text-[16px]">Meine Termine</span>
              <input
                type="checkbox"
                checked={termineTeilen}
                onChange={(e) => setTermineTeilen(e.target.checked)}
                className="h-7 w-7 accent-brand-500"
              />
            </label>
          </div>
          <p className="px-2 text-[14px] leading-relaxed text-ink-muted">
            Urlaub, V-Tage und andere freie Tage sieht dein Partner nur als „Urlaub“ – ohne Grund.
            Er trägt seine eigenen Schichten, seinen Urlaub und Termine ein. Deine Einträge kann er
            nicht ändern.
          </p>
        </div>
        {fehlerBox}
        <div className="px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            disabled={laeuft}
            onClick={erstellen}
            className="h-14 w-full rounded-full bg-brand-500 text-[17px] font-semibold text-white disabled:opacity-60"
          >
            {laeuft ? "Wird erstellt …" : "Weiter"}
          </button>
        </div>
      </div>
    );
  } else {
    const kodiert = encodeURIComponent(nachricht);
    const wege: { href?: string; onClick?: () => void; icon: React.ReactNode; farbe: string; text: string }[] = [
      { href: `sms:?&body=${kodiert}`, icon: <MessageCircle className="h-6 w-6" />, farbe: "bg-[#34c759]", text: "Mit Nachrichten einladen" },
      { href: `https://wa.me/?text=${kodiert}`, icon: <MessageCircle className="h-6 w-6" />, farbe: "bg-[#25d366]", text: "Mit WhatsApp einladen" },
      {
        href: `mailto:?subject=${encodeURIComponent("Mein Schichtplan")}&body=${kodiert}`,
        icon: <Mail className="h-6 w-6" />,
        farbe: "bg-[#2f7cf6]",
        text: "Mit E-Mail einladen",
      },
      { onClick: () => void sonstige(), icon: <Share2 className="h-6 w-6" />, farbe: "bg-[#3a8fb7]", text: "Sonstige (AirDrop …)" },
    ];
    inhalt = (
      <div className="min-h-full pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <Kopf titel="Sende deine Einladung" onClose={onClose} />
        {fehlerBox}
        <ul className="mx-4 overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
          {wege.map((w, i) => {
            const innen = (
              <>
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white", w.farbe)}>
                  {w.icon}
                </span>
                <span className={cn("flex-1 py-4 text-[16px]", i > 0 && "border-t border-line")}>{w.text}</span>
              </>
            );
            return (
              <li key={w.text}>
                {w.href ? (
                  <a href={w.href} target={w.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-4 px-4">
                    {innen}
                  </a>
                ) : (
                  <button type="button" onClick={w.onClick} className="flex w-full items-center gap-4 px-4 text-left">
                    {innen}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mx-4 mt-6 space-y-1 px-1">
          <p className="text-[20px] font-bold">Oder per QR-Code teilen</p>
          <p className="text-[14px] text-ink-muted">
            Dein Partner scannt den Code mit der Kamera und ist sofort in deinem Kalender.
          </p>
        </div>
        <div className="mx-4 mt-3 rounded-3xl bg-white p-6 ring-1 ring-line">
          <div className="relative mx-auto aspect-square w-full max-w-[260px]">
            {/* Ecken wie ein Sucher */}
            <span aria-hidden className="absolute -left-3 -top-3 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-brand-500" />
            <span aria-hidden className="absolute -right-3 -top-3 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-brand-500" />
            <span aria-hidden className="absolute -bottom-3 -left-3 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-brand-500" />
            <span aria-hidden className="absolute -bottom-3 -right-3 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-brand-500" />
            {qr ? (
              <div
                role="img"
                aria-label="QR-Code der Einladung"
                className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
                // Selbst erzeugtes SVG aus der Bibliothek „qrcode“ – kein fremder Inhalt.
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            ) : (
              <div className="h-full w-full animate-pulse rounded-xl bg-surface-sunken" />
            )}
          </div>
        </div>

        <div className="mx-4 mt-6 space-y-2">
          <p className="select-all break-all rounded-2xl bg-surface px-4 py-3 font-mono text-[12px] text-ink-muted ring-1 ring-line">
            {link}
          </p>
          <button
            type="button"
            onClick={kopieren}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-surface text-[15px] font-semibold text-brand-600 ring-1 ring-line"
          >
            {kopiert ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {kopiert ? "Kopiert" : "Link kopieren"}
          </button>
          <p className="px-2 text-center text-[12px] text-ink-faint">
            Der Link wird nur jetzt angezeigt. Wer ihn hat, sieht deinen Kalender – gib ihn nur deinem Partner.
          </p>
        </div>
      </div>
    );
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Kalender teilen" className="fixed inset-0 z-50 overflow-y-auto bg-surface-muted">
      {inhalt}
    </div>,
    document.body,
  );
}
