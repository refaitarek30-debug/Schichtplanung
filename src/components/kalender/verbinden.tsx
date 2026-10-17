"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Link2, QrCode, Share2 } from "lucide-react";
import { PERSON_ARTEN, type PersonArt } from "@/lib/data/partner";
import {
  codeAnzeige,
  verbindungAendern,
  verbindungAnnehmen,
  verbindungBeenden,
  verbindungCodeErstellen,
  verbindungCodeInfo,
  type CodeInfo,
  type Verbindung,
} from "@/lib/data/verbindungen";
import { formatZeitpunkt } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Konten verbinden (Migration 0157): Code und QR-Code zeigen, einen Code
 * eingeben, verbundene Konten auflisten und ihre Rechte einstellen.
 */

const linkZu = (code: string) => `${window.location.origin}/verbinden/${code}`;

/** Zeigt einen frischen Code mit QR-Code. person: bisher per Link eingeladene Person übernehmen. */
export function CodeZeigen({ person }: { person?: { id: string; name: string } }) {
  const [code, setCode] = useState<{ code: string; gueltigBis: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);

  useEffect(() => {
    let aus = false;
    verbindungCodeErstellen(person?.id ?? null)
      .then(async (c) => {
        if (aus) return;
        setCode(c);
        const qrcode = await import("qrcode");
        const svg = await qrcode.toString(linkZu(c.code), { type: "svg", margin: 0, errorCorrectionLevel: "M" });
        if (!aus) setQr(svg);
      })
      .catch((e: unknown) => !aus && setFehler(e instanceof Error ? e.message : "Der Code konnte nicht erstellt werden."));
    return () => {
      aus = true;
    };
  }, [person?.id]);

  const text = code
    ? `Verbinde dich mit meinem Schichtkalender: Code ${codeAnzeige(code.code)} oder ${linkZu(code.code)}`
    : "";

  async function teilen() {
    if (!code) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Kalender verbinden", text, url: linkZu(code.code) });
        return;
      } catch {
        // abgebrochen
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    } catch {
      setFehler("Kopieren ging nicht – bitte den Code abschreiben.");
    }
  }

  return (
    <div className="space-y-4 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <p className="px-1 text-[14.5px] leading-relaxed text-ink-muted">
        {person
          ? `${person.name} hat jetzt einen eigenen Kalender? Dann verbindet ihr euch: ${person.name} scannt den Code oder gibt ihn unter Teilen → „Code eingeben“ ein. Termine und Einträge von ${person.name} bleiben, der bisherige Link endet.`
          : "Die andere Person scannt den QR-Code mit der Kamera oder gibt den Code in ihrem Kalender unter Teilen → „Code eingeben“ ein. Danach seht ihr gegenseitig eure Schichten."}
      </p>
      {fehler ? <p className="rounded-xl bg-crit-bg px-3 py-2 text-[14px] text-crit-fg">{fehler}</p> : null}
      <div className="rounded-3xl bg-white p-6 ring-1 ring-line">
        <div className="relative mx-auto aspect-square w-full max-w-[220px]">
          {qr ? (
            <div
              role="img"
              aria-label="QR-Code zum Verbinden"
              className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
              // Selbst erzeugtes SVG aus der Bibliothek „qrcode“ – kein fremder Inhalt.
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          ) : (
            <div className="h-full w-full animate-pulse rounded-xl bg-surface-sunken" />
          )}
        </div>
        <p className="mt-5 text-center font-mono text-[34px] font-bold tracking-[0.12em] text-ink" aria-label="Code">
          {code ? codeAnzeige(code.code) : "··· ···"}
        </p>
        <p className="mt-1 text-center text-[12.5px] text-ink-muted">
          {code ? `Gilt bis ${formatZeitpunkt(code.gueltigBis)} · nur einmal` : "Einen Moment …"}
        </p>
      </div>
      <button
        type="button"
        disabled={!code}
        onClick={() => void teilen()}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-500 text-[15.5px] font-semibold text-white disabled:opacity-60"
      >
        {kopiert ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {kopiert ? "Kopiert" : "Code senden"}
      </button>
    </div>
  );
}

/** Code einer anderen Person eingeben (oder aus dem Link übernehmen) und sich verbinden. */
export function CodeEingeben({
  start = "",
  sofort = false,
  onVerbunden,
}: {
  start?: string;
  /** Gleich verbinden (direkt nach dem Anlegen des Kontos aus der Einladung). */
  sofort?: boolean;
  onVerbunden: () => void;
}) {
  const [code, setCode] = useState(start);
  const [info, setInfo] = useState<CodeInfo | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const roh = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  async function pruefen() {
    setLaeuft(true);
    setFehler(null);
    try {
      const i = await verbindungCodeInfo(roh);
      if (!i.gueltig) setFehler("Dieser Code stimmt nicht oder ist abgelaufen.");
      else if (i.eigener) setFehler("Das ist dein eigener Code – schick ihn der anderen Person.");
      else if (i.schon) setFehler(`Du bist mit ${i.name || "dieser Person"} schon verbunden.`);
      else setInfo(i);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Code konnte nicht geprüft werden.");
    } finally {
      setLaeuft(false);
    }
  }

  async function verbinden() {
    setLaeuft(true);
    setFehler(null);
    try {
      const id = await verbindungAnnehmen(roh);
      if (!id) {
        setFehler("Dieser Code stimmt nicht oder ist abgelaufen.");
        setInfo(null);
      } else onVerbunden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das Verbinden hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  }

  // Aus dem Link: gleich prüfen.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (start && start.replace(/[^A-Za-z0-9]/g, "").length === 6) void (sofort ? verbinden() : pruefen());
    // nur beim Öffnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (info) {
    return (
      <div className="space-y-4 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="rounded-3xl bg-surface p-5 text-center ring-1 ring-line">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Verbinden mit</p>
          <p className="mt-1 text-[26px] font-bold tracking-tight">{info.name || "Unbekannt"}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
            Ihr seht gegenseitig eure Schichten. Ob {info.name || "die Person"} deine Termine sieht oder bei dir eintragen
            darf, stellst du danach selbst ein – am Anfang ist beides aus.
            {info.uebernahme ? " Was du bisher über den Link eingetragen hast, bleibt erhalten." : ""}
          </p>
        </div>
        {fehler ? <p className="rounded-xl bg-crit-bg px-3 py-2 text-[14px] text-crit-fg">{fehler}</p> : null}
        <button
          type="button"
          disabled={laeuft}
          onClick={() => void verbinden()}
          className="h-14 w-full rounded-full bg-brand-500 text-[17px] font-semibold text-white disabled:opacity-60"
        >
          {laeuft ? "Einen Moment …" : "Verbinden"}
        </button>
        <button type="button" onClick={() => setInfo(null)} className="h-11 w-full text-[15px] font-semibold text-ink-muted">
          Abbrechen
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault();
        void pruefen();
      }}
    >
      <p className="px-1 text-[14.5px] leading-relaxed text-ink-muted">
        Gib den Code ein, den du bekommen hast – oder scanne den QR-Code einfach mit der Kamera deines Handys.
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
        placeholder="ABC-123"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-label="Code"
        className="h-16 w-full rounded-[18px] bg-surface text-center font-mono text-[30px] font-bold tracking-[0.15em] outline-none ring-1 ring-line placeholder:text-ink-faint focus:ring-2 focus:ring-brand-500"
      />
      {fehler ? <p className="rounded-xl bg-crit-bg px-3 py-2 text-[14px] text-crit-fg">{fehler}</p> : null}
      <button
        type="submit"
        disabled={laeuft || roh.length !== 6}
        className="h-14 w-full rounded-full bg-brand-500 text-[17px] font-semibold text-white disabled:opacity-50"
      >
        {laeuft ? "Einen Moment …" : "Weiter"}
      </button>
    </form>
  );
}

/** Verbundene Konten – auch eingebettet (Privatbereich „Teilen“). */
export function VerbindungenListe({
  verbindungen,
  farbe,
  onVerbindung,
  onCodeZeigen,
  onCodeEingeben,
}: {
  verbindungen: Verbindung[] | null;
  farbe: (v: Verbindung) => string;
  onVerbindung: (id: string) => void;
  onCodeZeigen: () => void;
  onCodeEingeben: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCodeZeigen}
          className="flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-surface text-[14.5px] font-semibold text-ink ring-1 ring-line"
        >
          <QrCode className="h-[18px] w-[18px]" /> Mein Code
        </button>
        <button
          type="button"
          onClick={onCodeEingeben}
          className="flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-surface text-[14.5px] font-semibold text-ink ring-1 ring-line"
        >
          <Link2 className="h-[18px] w-[18px]" /> Code eingeben
        </button>
      </div>
      {verbindungen && verbindungen.length ? (
        <ul className="overflow-hidden rounded-[22px] bg-surface ring-1 ring-line">
          {verbindungen.map((v, i) => (
            <li key={v.id} className={cn(i > 0 && "border-t border-line")}>
              <button type="button" onClick={() => onVerbindung(v.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{ backgroundColor: farbe(v) }}
                >
                  {(v.name || "?").slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{v.name || "Ohne Namen"}</span>
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    {PERSON_ARTEN.find((a) => a.art === v.art)?.text ?? v.art} · eigenes Konto
                  </span>
                </span>
                <span className="shrink-0 rounded-lg bg-[#E6F1E9] px-2 py-0.5 text-[11.5px] font-semibold text-[#1C6E49]">verbunden</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 text-[12.5px] leading-snug text-ink-muted">
          Hat die andere Person auch einen Kalender? Dann verbindet euch per Code – ihr seht gegenseitig eure echten Schichten.
        </p>
      )}
    </div>
  );
}

/** Rechte für eine Verbindung – nur meine Seite. */
export function VerbindungEinstellen({ v, onFertig }: { v: Verbindung; onFertig: () => void }) {
  const [art, setArt] = useState<PersonArt>(v.art);
  const [termine, setTermine] = useState(v.ichTermine);
  const [darf, setDarf] = useState(v.ichDarf);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [beendenFrage, setBeendenFrage] = useState(false);

  async function los(fn: () => Promise<void>) {
    setLaeuft(true);
    setFehler(null);
    try {
      await fn();
      onFertig();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      setLaeuft(false);
    }
  }

  const schalter = (an: boolean, set: (b: boolean) => void, titel: string, text: string) => (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5">
      <span>
        <span className="block text-[15.5px] font-semibold">{titel}</span>
        <span className="block text-[12.5px] text-ink-muted">{text}</span>
      </span>
      <input type="checkbox" checked={an} onChange={(e) => set(e.target.checked)} className="h-6 w-6 shrink-0 accent-brand-500" />
    </label>
  );

  return (
    <div className="space-y-5 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <p className="px-1 text-[13px] text-ink-muted">
        Verbunden seit {formatZeitpunkt(v.seit)} · {v.name} {v.erTermine ? "zeigt dir die Termine" : "zeigt dir keine Termine"}
        {v.erDarf ? " und du darfst eintragen." : "."}
      </p>
      <div className="space-y-2">
        <span className="text-[13px] font-semibold text-ink-muted">Wer ist das?</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Wer ist das?">
          {PERSON_ARTEN.map((a) => (
            <button
              key={a.art}
              type="button"
              role="radio"
              aria-checked={art === a.art}
              onClick={() => setArt(a.art)}
              className={cn("h-10 rounded-full px-4 text-[14px] font-semibold", art === a.art ? "bg-ink text-surface" : "bg-surface text-ink ring-1 ring-line")}
            >
              {a.text}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-[18px] bg-surface ring-1 ring-line [&>label+label]:border-t [&>label+label]:border-line">
        {schalter(termine, setTermine, "Meine Termine zeigen", `${v.name} sieht deine Termine – sonst nur deine Schichten`)}
        {schalter(darf, setDarf, "Darf bei mir eintragen", `${v.name} kann Termine in deinen Kalender eintragen`)}
      </div>
      {fehler ? <p className="rounded-xl bg-crit-bg px-3 py-2 text-[14px] text-crit-fg">{fehler}</p> : null}
      <button
        type="button"
        disabled={laeuft}
        onClick={() => void los(() => verbindungAendern(v.id, art, termine, darf))}
        className="h-14 w-full rounded-full bg-brand-500 text-[17px] font-semibold text-white disabled:opacity-60"
      >
        {laeuft ? "Einen Moment …" : "Speichern"}
      </button>
      {beendenFrage ? (
        <div className="space-y-2 rounded-[18px] bg-crit-bg/40 px-4 py-3.5">
          <p className="text-[14px] text-crit-fg">
            Ihr seht euch danach gegenseitig nicht mehr. Termine, die eingetragen wurden, bleiben im jeweiligen Kalender.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={laeuft}
              onClick={() => void los(() => verbindungBeenden(v.id))}
              className="h-11 flex-1 rounded-xl bg-crit-fg font-semibold text-white"
            >
              Verbindung beenden
            </button>
            <button
              type="button"
              onClick={() => setBeendenFrage(false)}
              className="h-11 flex-1 rounded-xl bg-surface font-semibold text-ink-muted ring-1 ring-line"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setBeendenFrage(true)} className="h-11 w-full text-[15.5px] font-semibold text-crit-fg">
          Verbindung beenden
        </button>
      )}
    </div>
  );
}

