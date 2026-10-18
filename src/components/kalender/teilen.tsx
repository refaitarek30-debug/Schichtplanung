"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Copy, Link2, Mail, MessageCircle, Share2, UserPlus, Users, X } from "lucide-react";
import { addDays, formatDE, formatZeitpunkt, fromISO, heuteInBerlin } from "@/lib/dates";
import {
  fetchGruppeTage,
  fetchGruppen,
  gruppeErstellen,
  gruppeLinkNeu,
  gruppeVerlassen,
  istFrei,
  type Gruppe,
  type GruppenMitglied,
} from "@/lib/data/gruppen";
import {
  PERSON_ARTEN,
  fetchPersonen,
  personAendern,
  einladungErstellen,
  fetchEinladungen,
  personEntfernen,
  personLinkBeenden,
  type Person,
  type PersonArt,
  type PersonEingabe,
} from "@/lib/data/partner";
import { textFarbe } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";
import { fetchVerbindungen, verbindungCodeErstellen, type Verbindung } from "@/lib/data/verbindungen";
import { CodeEingeben, CodeZeigen, VerbindungEinstellen, VerbindungenListe } from "./verbinden";

/**
 * Kalender teilen – mit beliebig vielen Personen (Partner, Familie,
 * Freunde, Kollegen; Migration 0151):
 *   * Liste: wer den Kalender sieht, wann zuletzt geöffnet
 *   * Einladen: Name, wer das ist, „nur ansehen“ oder „ansehen und
 *     eintragen“, ob die eigenen Termine sichtbar sind
 *   * Senden: WhatsApp, Nachrichten, E-Mail, Teilen, QR-Code
 *   * Person: Rechte ändern, Einladung neu senden, alten Link beenden, entfernen
 *
 * Seit Migration 0163 führt jede Einladung zur Anmeldeseite: Die Person legt
 * Spitzname und Passwort an und ist danach mit dem eigenen Konto verbunden
 * (Link gilt 7 Tage, einmal). Alte Links ohne Konto laufen weiter, bis sie
 * beendet werden – neue gibt es nicht mehr.
 */

type Ansicht =
  | { art: "liste" }
  | { art: "neu" }
  | { art: "person"; id: string }
  | { art: "gruppeNeu" }
  | { art: "gruppe"; id: string }
  | { art: "senden"; name: string; link: string; gruppe?: boolean; einladung?: boolean }
  | { art: "code"; person?: { id: string; name: string } }
  | { art: "codeEingeben" }
  | { art: "verbindung"; id: string };

/** Farbe je Person – fest nach Reihenfolge, damit sie überall gleich ist. */
export const PERSON_FARBEN = ["#2f54eb", "#22A06B", "#9B59D0", "#F76B15", "#0E9F9F", "#D6409F", "#8D6E4E", "#E5484D"];

export function personFarbe(personen: { id: string }[], id: string): string {
  const i = personen.findIndex((p) => p.id === id);
  return PERSON_FARBEN[(i < 0 ? 0 : i) % PERSON_FARBEN.length];
}

export function kuerzel(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (teile.length >= 2) return (teile[0][0] + teile[1][0]).toUpperCase();
  return (teile[0] ?? "?").slice(0, 2).toUpperCase();
}

function artText(art: PersonArt) {
  return PERSON_ARTEN.find((a) => a.art === art)?.text ?? art;
}

function Kopf({ titel, onZurueck, onClose }: { titel: string; onZurueck?: () => void; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
      {onZurueck ? (
        <button
          type="button"
          onClick={onZurueck}
          aria-label="Zurück"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm ring-1 ring-line"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}
      <h2 className="min-w-0 flex-1 truncate text-[24px] font-bold tracking-tight">{titel}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Schließen"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm ring-1 ring-line"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

export function PersonAvatar({ name, farbe, klein }: { name: string; farbe: string; klein?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        klein ? "h-7 w-7 text-[11px]" : "h-10 w-10 text-[13px]",
      )}
      style={{ backgroundColor: farbe, color: textFarbe(farbe) }}
    >
      {kuerzel(name)}
    </span>
  );
}

function zuletzt(p: Person, einladungBis?: string): string {
  if (einladungBis) return `eingeladen · wartet auf Anmeldung bis ${formatZeitpunkt(einladungBis).replace(/ um .*$/, "")}`;
  if (!p.linkAktiv) return p.linkErstelltAm ? "Link beendet" : "Einladung abgelaufen – neu senden";
  return p.zuletztGenutzt ? `zuletzt geöffnet ${formatZeitpunkt(p.zuletztGenutzt)}` : "noch nicht geöffnet";
}

/** Liste der Personen – auch eingebettet (Privatbereich „Teilen“). */
export function PersonenListe({
  personen,
  einladungen = {},
  onPerson,
  onNeu,
}: {
  personen: Person[] | null;
  /** Offene Einladungen: Person -> gültig bis. */
  einladungen?: Record<string, string>;
  onPerson: (id: string) => void;
  onNeu: () => void;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onNeu}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-brand-500 text-[16px] font-semibold text-white"
      >
        <UserPlus className="h-5 w-5" /> Person einladen
      </button>
      {personen === null ? (
        <div className="h-20 animate-pulse rounded-[22px] bg-surface-sunken" />
      ) : personen.length === 0 ? (
        <p className="rounded-[22px] bg-surface px-4 py-5 text-center text-[14px] text-ink-muted ring-1 ring-line">
          Noch niemand eingeladen. Lade deinen Partner, deine Familie oder Freunde ein – mit dem Link legen sie ihren
          eigenen Kalender an und ihr seid verbunden.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[22px] bg-surface ring-1 ring-line">
          {personen.map((p, i) => (
            <li key={p.id} className={cn(i > 0 && "border-t border-line")}>
              <button type="button" onClick={() => onPerson(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <PersonAvatar name={p.name} farbe={personFarbe(personen, p.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{p.name}</span>
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    {artText(p.art)} · {zuletzt(p, einladungen[p.id])}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-lg px-2 py-0.5 text-[11.5px] font-semibold",
                    p.darfEintragen ? "bg-brand-50 text-brand-700" : "bg-surface-sunken text-ink-muted",
                  )}
                >
                  {p.darfEintragen ? "trägt ein" : "sieht"}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-[12.5px] leading-snug text-ink-muted">
        Krank, Urlaub und andere freie Tage sieht niemand mit Grund – nur als „Urlaub“.
      </p>
    </div>
  );
}

/** Formular: neue Person oder bestehende ändern. */
function PersonFormular({
  start,
  knopf,
  laeuft,
  onSenden,
}: {
  start: PersonEingabe;
  knopf: string;
  laeuft: boolean;
  onSenden: (p: PersonEingabe) => void;
}) {
  const [p, setP] = useState<PersonEingabe>(start);
  const setze = <K extends keyof PersonEingabe>(k: K, v: PersonEingabe[K]) => setP((a) => ({ ...a, [k]: v }));
  const recht = (darf: boolean, titel: string, text: string) => (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 px-4 py-3.5",
        p.darfEintragen === darf && "bg-brand-50/70",
        darf && "border-t border-line",
      )}
    >
      <input
        type="radio"
        name="recht"
        checked={p.darfEintragen === darf}
        onChange={() => setze("darfEintragen", darf)}
        className="h-5 w-5 accent-brand-500"
      />
      <span className="min-w-0">
        <span className="block text-[15.5px] font-semibold">{titel}</span>
        <span className="block text-[12.5px] text-ink-muted">{text}</span>
      </span>
    </label>
  );

  return (
    <form
      className="space-y-5 px-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSenden(p);
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-[13px] font-semibold text-ink-muted">Name</span>
        <input
          value={p.name}
          onChange={(e) => setze("name", e.target.value)}
          maxLength={40}
          required
          placeholder="z. B. Mama, Lea, Jonas"
          className="h-12 w-full rounded-[14px] bg-surface px-4 text-[16px] outline-none ring-1 ring-line focus:ring-2 focus:ring-brand-500"
        />
      </label>

      <div className="space-y-2">
        <span className="text-[13px] font-semibold text-ink-muted">Wer ist das?</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Wer ist das?">
          {PERSON_ARTEN.map((a) => (
            <button
              key={a.art}
              type="button"
              role="radio"
              aria-checked={p.art === a.art}
              onClick={() => setze("art", a.art)}
              className={cn(
                "h-10 rounded-full px-4 text-[14px] font-semibold",
                p.art === a.art ? "bg-ink text-surface" : "bg-surface text-ink ring-1 ring-line",
              )}
            >
              {a.text}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[13px] font-semibold text-ink-muted">Darf …</span>
        <div className="overflow-hidden rounded-[18px] bg-surface ring-1 ring-line">
          {recht(false, "nur ansehen", "Sieht deine Schichten und freien Tage")}
          {recht(true, "ansehen und eintragen", "Trägt eigene Arbeitstage und Termine ein – die siehst du auch")}
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[18px] bg-surface px-4 py-3.5 ring-1 ring-line">
        <span>
          <span className="block text-[15.5px] font-semibold">Meine Termine zeigen</span>
          <span className="block text-[12.5px] text-ink-muted">Sonst sieht die Person nur deine Schichten</span>
        </span>
        <input
          type="checkbox"
          checked={p.termineSehen}
          onChange={(e) => setze("termineSehen", e.target.checked)}
          className="h-6 w-6 accent-brand-500"
        />
      </label>

      <button
        type="submit"
        disabled={laeuft || !p.name.trim()}
        className="h-14 w-full rounded-full bg-brand-500 text-[17px] font-semibold text-white disabled:opacity-60"
      >
        {laeuft ? "Einen Moment …" : knopf}
      </button>
    </form>
  );
}

function Senden({
  name,
  link,
  vorname,
  gruppe = false,
  einladung = false,
}: {
  name: string;
  link: string;
  vorname: string;
  gruppe?: boolean;
  /** Einladung mit eigenem Konto (Link zur Anmeldeseite, 7 Tage). */
  einladung?: boolean;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // QR-Code im Browser erzeugen – der Link verlässt das Gerät dafür nicht.
  useEffect(() => {
    let aus = false;
    import("qrcode")
      .then((qrcode) => qrcode.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M" }))
      .then((svg) => !aus && setQr(svg))
      .catch(() => undefined);
    return () => {
      aus = true;
    };
  }, [link]);

  const nachricht = gruppe
    ? `Komm in unsere Gruppe „${name}“ – dann sehen wir, wann wir alle frei haben: ${link}`
    : einladung
      ? `Hallo ${name}, ich lade dich in meinen Schichtkalender ein${vorname ? ` (${vorname})` : ""}. Leg dir mit dem Link kurz ein Konto an, dann sehen wir gegenseitig unsere Schichten: ${link}`
      : `Hallo ${name}, hier ist mein Schichtplan${vorname ? ` (${vorname})` : ""}: ${link}`;

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(link);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    } catch {
      setFehler("Kopieren ging nicht – bitte den Link unten markieren und kopieren.");
    }
  }

  async function sonstige() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: einladung ? "Einladung zum Schichtkalender" : "Mein Schichtplan", text: nachricht, url: link });
      } catch {
        // abgebrochen
      }
    } else {
      await kopieren();
    }
  }

  const kodiert = encodeURIComponent(nachricht);
  const wege: { href?: string; onClick?: () => void; icon: React.ReactNode; farbe: string; text: string }[] = [
    { href: `https://wa.me/?text=${kodiert}`, icon: <MessageCircle className="h-6 w-6" />, farbe: "bg-[#25d366]", text: "Per WhatsApp senden" },
    { href: `sms:?&body=${kodiert}`, icon: <MessageCircle className="h-6 w-6" />, farbe: "bg-[#34c759]", text: "Per Nachricht senden" },
    {
      href: `mailto:?subject=${encodeURIComponent("Mein Schichtplan")}&body=${kodiert}`,
      icon: <Mail className="h-6 w-6" />,
      farbe: "bg-[#2f7cf6]",
      text: "Per E-Mail senden",
    },
    { onClick: () => void sonstige(), icon: <Share2 className="h-6 w-6" />, farbe: "bg-[#3a8fb7]", text: "Sonstige (AirDrop …)" },
  ];

  return (
    <div className="pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {fehler ? <p className="mx-4 mb-3 rounded-xl bg-crit-bg px-3 py-2 text-[14px] text-crit-fg">{fehler}</p> : null}
      <ul className="mx-4 overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
        {wege.map((w, i) => {
          const innen = (
            <>
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white", w.farbe)}>{w.icon}</span>
              <span className={cn("flex-1 py-4 text-[16px]", i > 0 && "border-t border-line")}>{w.text}</span>
            </>
          );
          return (
            <li key={w.text}>
              {w.href ? (
                <a
                  href={w.href}
                  target={w.href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="flex items-center gap-4 px-4"
                >
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
        <p className="text-[20px] font-bold">Oder per QR-Code</p>
        <p className="text-[14px] text-ink-muted">{gruppe ? "Den Code mit der Kamera scannen." : `${name} scannt den Code mit der Kamera.`}</p>
      </div>
      <div className="mx-4 mt-3 rounded-3xl bg-surface p-6 ring-1 ring-line">
        <div className="relative mx-auto aspect-square w-full max-w-[240px]">
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
        <p className="select-all break-all rounded-2xl bg-surface px-4 py-3 font-mono text-[12px] text-ink-muted ring-1 ring-line">{link}</p>
        <button
          type="button"
          onClick={kopieren}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-surface text-[15px] font-semibold text-brand-600 ring-1 ring-line"
        >
          {kopiert ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {kopiert ? "Kopiert" : "Link kopieren"}
        </button>
        <p className="px-2 text-center text-[12px] text-ink-faint">
          {gruppe
            ? "Wer den Link hat, legt einen eigenen Kalender an (oder meldet sich an) und kann der Gruppe beitreten."
            : einladung
              ? `Der Link gilt 7 Tage und nur einmal. Mit ihm legt ${name} Spitzname und Passwort an und ist danach mit dir verbunden – gib ihn nur ${name}.`
              : `Der Link wird nur jetzt angezeigt. Wer ihn hat, sieht deinen Kalender – gib ihn nur ${name}.`}
        </p>
      </div>
    </div>
  );
}

/** Liste der Gruppen – auch eingebettet (Privatbereich „Teilen“). */
export function GruppenListe({
  gruppen,
  onGruppe,
  onNeu,
}: {
  gruppen: Gruppe[] | null;
  onGruppe: (id: string) => void;
  onNeu: () => void;
}) {
  return (
    <div className="space-y-3">
      {gruppen && gruppen.length ? (
        <ul className="overflow-hidden rounded-[22px] bg-surface ring-1 ring-line">
          {gruppen.map((g, i) => (
            <li key={g.id} className={cn(i > 0 && "border-t border-line")}>
              <button type="button" onClick={() => onGruppe(g.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#22A06B]/15 text-ok-fg">
                  <Users className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{g.name}</span>
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    {g.mitglieder === 1 ? "nur du – lade jemanden ein" : `${g.mitglieder} Personen`}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={onNeu}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-surface text-[15px] font-semibold text-brand-600 ring-1 ring-line"
      >
        <Users className="h-[18px] w-[18px]" /> Gruppe erstellen
      </button>
      <p className="px-1 text-[12.5px] leading-snug text-ink-muted">
        Für Familie und Freunde mit eigenem Schichtkalender: Ihr seht, wann wer arbeitet – und wann ihr alle frei habt.
        Termine bleiben privat.
      </p>
    </div>
  );
}

const WT_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const CODE_FARBE: Record<string, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
  T: "bg-brand-100 text-brand-700",
  U: "bg-shift-urlaub text-shift-urlaub-ink",
};

function montag(iso: string) {
  return addDays(iso, -((fromISO(iso).getDay() + 6) % 7));
}

/** Woche der Gruppe mit „Alle frei“ und dem nächsten gemeinsamen freien Tag. */
function GruppenWoche({ id }: { id: string }) {
  const heute = heuteInBerlin();
  const [start, setStart] = useState(() => montag(heute));
  const [mitglieder, setMitglieder] = useState<GruppenMitglied[] | null>(null);
  const [naechster, setNaechster] = useState<string | null | undefined>(undefined);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let aus = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMitglieder(null);
    fetchGruppeTage(id, start, 7)
      .then((m) => !aus && setMitglieder(m))
      .catch((e: unknown) => !aus && setFehler(e instanceof Error ? e.message : "Die Gruppe konnte nicht geladen werden."));
    return () => {
      aus = true;
    };
  }, [id, start]);

  useEffect(() => {
    let aus = false;
    fetchGruppeTage(id, heute, 62)
      .then((m) => {
        if (aus) return;
        if (m.length < 2) return setNaechster(null);
        for (let i = 0; i < 62; i++) {
          const t = addDays(heute, i);
          if (m.every((x) => istFrei(x.tage[t]))) return setNaechster(t);
        }
        setNaechster(null);
      })
      .catch(() => !aus && setNaechster(null));
    return () => {
      aus = true;
    };
  }, [id, heute]);

  const tage = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const alleFrei = tage.map((t) => !!mitglieder && mitglieder.length > 1 && mitglieder.every((m) => istFrei(m.tage[t])));

  return (
    <div className="space-y-3 px-4">
      {naechster ? (
        <div className="flex items-center gap-3 rounded-[20px] bg-[#22A06B] px-4 py-3.5 text-white">
          <Check className="h-7 w-7 shrink-0" strokeWidth={2.5} />
          <span>
            <span className="block text-[13px] opacity-90">Nächster Tag, an dem alle frei haben</span>
            <span className="block text-[18px] font-bold">
              {WT_KURZ[(fromISO(naechster).getDay() + 6) % 7]}, {formatDE(naechster)}
            </span>
          </span>
        </div>
      ) : naechster === null && mitglieder && mitglieder.length > 1 ? (
        <p className="rounded-[20px] bg-surface px-4 py-3 text-[14px] text-ink-muted ring-1 ring-line">
          In den nächsten zwei Monaten habt ihr keinen gemeinsamen freien Tag.
        </p>
      ) : null}

      <div className="rounded-[22px] bg-surface p-3 ring-1 ring-line">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Vorige Woche" onClick={() => setStart(addDays(start, -7))} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[14px] font-semibold">
            {formatDE(start)} – {formatDE(addDays(start, 6))}
          </span>
          <button type="button" aria-label="Nächste Woche" onClick={() => setStart(addDays(start, 7))} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {fehler ? <p className="py-3 text-center text-[13px] text-crit-fg">{fehler}</p> : null}
        <div className="grid grid-cols-[4.2rem_repeat(7,minmax(0,1fr))] items-center gap-x-1 gap-y-1.5">
          <span />
          {tage.map((t, i) => (
            <span
              key={t}
              className={cn("rounded-lg py-0.5 text-center text-[10.5px] font-semibold text-ink-muted", alleFrei[i] && "bg-[#22A06B]/15 text-ok-fg", t === heute && "ring-1 ring-[#ff3b30]")}
            >
              {WT_KURZ[i]}
              <span className="block text-[13px] text-ink">{fromISO(t).getDate()}</span>
            </span>
          ))}
          {(mitglieder ?? []).map((m) => (
            <Zeilen key={m.id} m={m} tage={tage} />
          ))}
          {mitglieder && mitglieder.length > 1 ? (
            <>
              <span className="text-[11px] font-semibold text-ok-fg">alle frei</span>
              {alleFrei.map((f, i) => (
                <span key={i} className={cn("mx-auto h-1.5 w-full rounded-full", f ? "bg-[#22A06B]" : "bg-transparent")} />
              ))}
            </>
          ) : null}
        </div>
        {!mitglieder && !fehler ? <div className="mt-2 h-24 animate-pulse rounded-xl bg-surface-sunken" /> : null}
      </div>
      <p className="px-1 text-[12px] text-ink-muted">Frei, Urlaub und Krank zählen als frei – ohne Grund. Termine sieht niemand.</p>
    </div>
  );
}

function Zeilen({ m, tage }: { m: GruppenMitglied; tage: string[] }) {
  return (
    <>
      <span className="truncate text-[13px] font-semibold">{m.ich ? "Ich" : m.name || "Ohne Namen"}</span>
      {tage.map((t) => {
        const c = m.tage[t];
        return (
          <span
            key={t}
            className={cn(
              "flex h-8 items-center justify-center rounded-[8px] text-[12px] font-bold",
              c && c !== "X" ? CODE_FARBE[c] : "bg-surface-sunken text-ink-faint",
            )}
          >
            {c && c !== "X" ? (c === "U" ? "–" : c === "T" ? "A" : c) : "·"}
          </span>
        );
      })}
    </>
  );
}

export function KalenderTeilen({
  vorname,
  onClose,
  start = "liste",
  onGeaendert,
}: {
  vorname: string;
  onClose: () => void;
  /** Direkt mit dem Formular, einer Person oder einer Gruppe beginnen (Privatbereich). */
  start?: "liste" | "neu" | "gruppeNeu" | "code" | "codeEingeben" | { person: string } | { gruppe: string } | { verbindung: string };
  /** Nach jeder Änderung – z. B. damit eine eingebettete Liste neu lädt. */
  onGeaendert?: () => void;
}) {
  const [ansicht, setAnsicht] = useState<Ansicht>(() =>
    start === "neu"
      ? { art: "neu" }
      : start === "gruppeNeu"
        ? { art: "gruppeNeu" }
        : start === "code"
          ? { art: "code" }
          : start === "codeEingeben"
            ? { art: "codeEingeben" }
            : typeof start === "object"
              ? "person" in start
                ? { art: "person", id: start.person }
                : "verbindung" in start
                  ? { art: "verbindung", id: start.verbindung }
                  : { art: "gruppe", id: start.gruppe }
              : { art: "liste" },
  );
  const [verbindungen, setVerbindungen] = useState<Verbindung[] | null>(null);
  const [gruppen, setGruppen] = useState<Gruppe[] | null>(null);
  const [gruppenName, setGruppenName] = useState("");
  const [austretenFrage, setAustretenFrage] = useState(false);
  const zurueckZurListe = start === "liste";
  const [personen, setPersonen] = useState<Person[] | null>(null);
  const [einladungen, setEinladungen] = useState<Record<string, string>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [entfernenFrage, setEntfernenFrage] = useState(false);

  const laden = useCallback(async () => {
    try {
      const [p, g, v, e] = await Promise.all([
        fetchPersonen(),
        fetchGruppen(),
        fetchVerbindungen().catch(() => []),
        fetchEinladungen().catch(() => ({})),
      ]);
      setPersonen(p);
      setGruppen(g);
      setVerbindungen(v);
      setEinladungen(e);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler beim Laden.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden]);

  const geaendert = useCallback(async () => {
    await laden();
    onGeaendert?.();
  }, [laden, onGeaendert]);

  async function ausfuehren(fn: () => Promise<void>) {
    setLaeuft(true);
    setFehler(null);
    try {
      await fn();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  }

  const einladungsLink = (code: string) => `${window.location.origin}/verbinden/${code}`;
  const gruppenLink = (schluessel: string) => `${window.location.origin}/gruppe/${schluessel}`;
  const ende = zurueckZurListe ? () => setAnsicht({ art: "liste" }) : onClose;
  const fehlerBox = fehler ? <p className="mx-4 mb-3 rounded-xl bg-crit-bg px-3 py-2 text-[14px] text-crit-fg">{fehler}</p> : null;

  let inhalt: React.ReactNode;
  if (ansicht.art === "liste") {
    inhalt = (
      <>
        <Kopf titel="Teilen" onClose={onClose} />
        {fehlerBox}
        <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <p className="mb-3 px-1 text-[14.5px] text-ink-muted">Wer deinen Kalender sehen darf.</p>
          <PersonenListe
            personen={personen}
            einladungen={einladungen}
            onNeu={() => setAnsicht({ art: "neu" })}
            onPerson={(id) => {
              setEntfernenFrage(false);
              setAnsicht({ art: "person", id });
            }}
          />
          <p className="mb-2 mt-6 flex items-center gap-2 px-1 text-[13px] font-semibold text-ink-muted">
            <Link2 className="h-4 w-4" /> Mit eigenem Konto verbunden
          </p>
          <VerbindungenListe
            verbindungen={verbindungen}
            farbe={(v) => PERSON_FARBEN[((personen?.length ?? 0) + (verbindungen?.indexOf(v) ?? 0)) % PERSON_FARBEN.length]}
            onVerbindung={(id) => setAnsicht({ art: "verbindung", id })}
            onCodeZeigen={() => setAnsicht({ art: "code" })}
            onCodeEingeben={() => setAnsicht({ art: "codeEingeben" })}
          />
          <p className="mb-2 mt-6 flex items-center gap-2 px-1 text-[13px] font-semibold text-ink-muted">
            <Users className="h-4 w-4" /> Gruppen
          </p>
          <GruppenListe
            gruppen={gruppen}
            onNeu={() => setAnsicht({ art: "gruppeNeu" })}
            onGruppe={(id) => {
              setAustretenFrage(false);
              setAnsicht({ art: "gruppe", id });
            }}
          />
        </div>
      </>
    );
  } else if (ansicht.art === "gruppeNeu") {
    inhalt = (
      <>
        <Kopf titel="Gruppe erstellen" onZurueck={zurueckZurListe ? ende : undefined} onClose={onClose} />
        {fehlerBox}
        <form
          className="space-y-5 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            void ausfuehren(async () => {
              const name = gruppenName.trim();
              const { schluessel } = await gruppeErstellen(name);
              await geaendert();
              setGruppenName("");
              setAnsicht({ art: "senden", name, link: gruppenLink(schluessel), gruppe: true });
            });
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-ink-muted">Name der Gruppe</span>
            <input
              value={gruppenName}
              onChange={(e) => setGruppenName(e.target.value)}
              maxLength={40}
              required
              placeholder="z. B. Familie, WG, Freunde"
              className="h-12 w-full rounded-[14px] bg-surface px-4 text-[16px] outline-none ring-1 ring-line focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <p className="px-1 text-[13.5px] leading-relaxed text-ink-muted">
            Wer der Gruppe beitritt, braucht einen eigenen Schichtkalender (kostenlos, nur Spitzname und Passwort).
            Alle sehen, wann die anderen arbeiten oder frei haben – Gründe für freie Tage und Termine sieht niemand.
          </p>
          <button
            type="submit"
            disabled={laeuft || !gruppenName.trim()}
            className="h-14 w-full rounded-full bg-brand-500 text-[17px] font-semibold text-white disabled:opacity-60"
          >
            {laeuft ? "Einen Moment …" : "Erstellen und einladen"}
          </button>
        </form>
      </>
    );
  } else if (ansicht.art === "gruppe") {
    const g = gruppen?.find((x) => x.id === ansicht.id);
    inhalt = (
      <>
        <Kopf titel={g?.name ?? "Gruppe"} onZurueck={zurueckZurListe ? ende : undefined} onClose={onClose} />
        {fehlerBox}
        <div className="space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <GruppenWoche id={ansicht.id} />
          <div className="mx-4 overflow-hidden rounded-[18px] bg-surface ring-1 ring-line">
            <button
              type="button"
              disabled={laeuft}
              onClick={() =>
                void ausfuehren(async () => {
                  const schluessel = await gruppeLinkNeu(ansicht.id);
                  setAnsicht({ art: "senden", name: g?.name ?? "Gruppe", link: gruppenLink(schluessel), gruppe: true });
                })
              }
              className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[15.5px] font-semibold text-brand-600"
            >
              Jemanden einladen
              <ChevronRight className="h-4 w-4" />
            </button>
            {austretenFrage ? (
              <div className="space-y-2 border-t border-line bg-crit-bg/40 px-4 py-3.5">
                <p className="text-[14px] text-crit-fg">
                  Du verlässt „{g?.name ?? "die Gruppe"}“. Die anderen sehen deine Schichten dann nicht mehr.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() =>
                      void ausfuehren(async () => {
                        await gruppeVerlassen(ansicht.id);
                        await geaendert();
                        ende();
                      })
                    }
                    className="h-11 flex-1 rounded-xl bg-crit-fg font-semibold text-white"
                  >
                    Austreten
                  </button>
                  <button
                    type="button"
                    onClick={() => setAustretenFrage(false)}
                    className="h-11 flex-1 rounded-xl bg-surface font-semibold text-ink-muted ring-1 ring-line"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAustretenFrage(true)}
                className="block w-full border-t border-line px-4 py-3.5 text-left text-[15.5px] font-semibold text-crit-fg"
              >
                Gruppe verlassen
              </button>
            )}
          </div>
        </div>
      </>
    );
  } else if (ansicht.art === "neu") {
    inhalt = (
      <>
        <Kopf titel="Person einladen" onZurueck={zurueckZurListe ? ende : undefined} onClose={onClose} />
        {fehlerBox}
        <div className="pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setAnsicht({ art: "code" })}
            className="mx-4 mb-5 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[18px] bg-ok-bg px-4 py-3.5 text-left"
          >
            <Link2 className="h-5 w-5 shrink-0 text-ok-fg" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Hat die Person schon einen Kalender?</span>
              <span className="block text-[12.5px] text-ink-muted">Dann per Code oder QR-Code verbinden – ihr seht euch gegenseitig.</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
          </button>
          <PersonFormular
            start={{ name: "", art: "partner", darfEintragen: false, termineSehen: false }}
            knopf="Einladen"
            laeuft={laeuft}
            onSenden={(p) =>
              void ausfuehren(async () => {
                const { code } = await einladungErstellen(p);
                await geaendert();
                setAnsicht({ art: "senden", name: p.name.trim(), link: einladungsLink(code), einladung: true });
              })
            }
          />
        </div>
      </>
    );
  } else if (ansicht.art === "person") {
    const p = personen?.find((x) => x.id === ansicht.id);
    inhalt = (
      <>
        <Kopf titel={p?.name ?? "Person"} onZurueck={zurueckZurListe ? ende : undefined} onClose={onClose} />
        {fehlerBox}
        {!p ? (
          <div className="mx-4 h-40 animate-pulse rounded-[22px] bg-surface-sunken" />
        ) : (
          <div className="space-y-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <p className="px-5 text-[13px] text-ink-muted">{zuletzt(p)}</p>
            <PersonFormular
              key={p.id}
              start={{ name: p.name, art: p.art, darfEintragen: p.darfEintragen, termineSehen: p.termineSehen }}
              knopf="Speichern"
              laeuft={laeuft}
              onSenden={(e) =>
                void ausfuehren(async () => {
                  await personAendern(p.id, e);
                  await geaendert();
                  ende();
                })
              }
            />
            <button
              type="button"
              disabled={laeuft}
              onClick={() =>
                void ausfuehren(async () => {
                  const { code } = await verbindungCodeErstellen(p.id);
                  await geaendert();
                  setAnsicht({ art: "senden", name: p.name, link: einladungsLink(code), einladung: true });
                })
              }
              className="mx-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[18px] bg-ok-bg px-4 py-3.5 text-left"
            >
              <Link2 className="h-5 w-5 shrink-0 text-ok-fg" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  {einladungen[p.id] ? "Einladung noch einmal senden" : "Einladung senden"}
                </span>
                <span className="block text-[12.5px] text-ink-muted">
                  {p.name} legt mit dem Link ein Konto an (oder meldet sich an) – danach seid ihr verbunden.
                  {p.linkAktiv ? ` Was ${p.name} bisher eingetragen hat, bleibt.` : ""}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
            </button>
            <div className="mx-4 overflow-hidden rounded-[18px] bg-surface ring-1 ring-line">
              {p.linkAktiv ? (
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() =>
                    void ausfuehren(async () => {
                      await personLinkBeenden(p.id);
                      await geaendert();
                    })
                  }
                  className="block w-full px-4 py-3.5 text-left text-[15.5px] font-semibold text-ink"
                >
                  Alten Link beenden
                  <span className="block text-[12.5px] font-normal text-ink-muted">
                    {p.name} sieht nichts mehr – Einträge bleiben.
                  </span>
                </button>
              ) : null}
              {entfernenFrage ? (
                <div className="space-y-2 border-t border-line bg-crit-bg/40 px-4 py-3.5">
                  <p className="text-[14px] text-crit-fg">
                    {p.name} wird entfernt – mit allen Tagen und Terminen, die {p.name} eingetragen hat.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={laeuft}
                      onClick={() =>
                        void ausfuehren(async () => {
                          await personEntfernen(p.id);
                          await geaendert();
                          ende();
                        })
                      }
                      className="h-11 flex-1 rounded-xl bg-crit-fg font-semibold text-white"
                    >
                      Entfernen
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntfernenFrage(false)}
                      className="h-11 flex-1 rounded-xl bg-surface font-semibold text-ink-muted ring-1 ring-line"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEntfernenFrage(true)}
                  className="block w-full border-t border-line px-4 py-3.5 text-left text-[15.5px] font-semibold text-crit-fg"
                >
                  Person entfernen
                </button>
              )}
            </div>
          </div>
        )}
      </>
    );
  } else if (ansicht.art === "code") {
    inhalt = (
      <>
        <Kopf
          titel={ansicht.person ? `${ansicht.person.name} verbinden` : "Mein Code"}
          onZurueck={zurueckZurListe ? ende : undefined}
          onClose={onClose}
        />
        <CodeZeigen person={ansicht.person} />
      </>
    );
  } else if (ansicht.art === "codeEingeben") {
    inhalt = (
      <>
        <Kopf titel="Code eingeben" onZurueck={zurueckZurListe ? ende : undefined} onClose={onClose} />
        <CodeEingeben
          onVerbunden={() =>
            void geaendert().then(() => {
              ende();
            })
          }
        />
      </>
    );
  } else if (ansicht.art === "verbindung") {
    const v = verbindungen?.find((x) => x.id === ansicht.id);
    inhalt = (
      <>
        <Kopf titel={v?.name || "Verbindung"} onZurueck={zurueckZurListe ? ende : undefined} onClose={onClose} />
        {v ? (
          <VerbindungEinstellen key={v.id} v={v} onFertig={() => void geaendert().then(() => ende())} />
        ) : (
          <div className="mx-4 h-40 animate-pulse rounded-[22px] bg-surface-sunken" />
        )}
      </>
    );
  } else {
    inhalt = (
      <>
        <Kopf
          titel={ansicht.gruppe ? `Einladen in „${ansicht.name}“` : `Einladung an ${ansicht.name}`}
          onZurueck={zurueckZurListe ? ende : undefined}
          onClose={onClose}
        />
        <Senden name={ansicht.name} link={ansicht.link} vorname={vorname} gruppe={ansicht.gruppe} einladung={ansicht.einladung} />
      </>
    );
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Kalender teilen" className="fixed inset-0 z-50 overflow-y-auto bg-surface-muted">
      {inhalt}
    </div>,
    document.body,
  );
}
