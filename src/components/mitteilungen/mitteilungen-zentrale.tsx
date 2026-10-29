"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  CalendarOff,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Megaphone,
  MessageSquare,
  Plus,
  Smartphone,
  Undo2,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/input";
import { RowSkeleton } from "@/components/ui/skeleton";
import { Blatt } from "@/components/privat/blatt";
import { HinweisSenden } from "@/components/hinweise/hinweis-senden";
import { useSession } from "@/context/session";
import { formatDE, formatDEShort, heuteInBerlin } from "@/lib/dates";
import { fetchAnnouncements } from "@/lib/data/announcements";
import { fetchLeaveBlocks } from "@/lib/data/staffing-rules";
import { fetchShiftOptions, type ShiftOption } from "@/lib/data/shifts";
import {
  fetchGesendeteHinweise,
  HinweisFehler,
  hinweisZurueckziehen,
  wannText,
  type GesendeterHinweis,
} from "@/lib/data/hinweise";
import { createAnnouncement, retireAnnouncement } from "@/lib/auth/announcement-actions";
import { createLeaveBlock, deleteLeaveBlock } from "@/lib/auth/staffing-rule-actions";
import type { FormState } from "@/lib/auth/form-state";
import type { LiveAnnouncement, LiveLeaveBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Mitteilungen – alles, was an die Belegschaft geht, in EINER Liste:
 * Hinweise an einzelne Personen, Mitteilungen an alle und Urlaubssperren.
 * Geschrieben wird über einen Knopf, der zuerst fragt „An wen?“.
 *
 * Wer was darf, prüfen weiter die Server-Aktionen und die Datenbank:
 * Hinweise und Mitteilungen an alle die Führung, Urlaubssperren nur die
 * Administration. Die Knöpfe hier blenden nur aus.
 */

export type Filter = "alle" | "personen" | "an_alle" | "sperren";

type Eintrag =
  | { art: "an_alle"; datum: string; mitteilung: LiveAnnouncement }
  | { art: "personen"; datum: string; gruppe: GesendeterHinweis[] }
  | { art: "sperre"; datum: string; sperre: LiveLeaveBlock };

const FILTER: { wert: Filter; label: string; nurFuehrung?: boolean }[] = [
  { wert: "alle", label: "Alle" },
  { wert: "personen", label: "Personen", nurFuehrung: true },
  { wert: "an_alle", label: "An alle" },
  { wert: "sperren", label: "Sperren" },
];

/**
 * Ein Hinweis an mehrere Personen sind in der Datenbank mehrere Zeilen mit
 * demselben Text und derselben Zeit (eine Anweisung) – hier wieder eine Zeile.
 */
function gruppiere(hinweise: GesendeterHinweis[]): GesendeterHinweis[][] {
  const gruppen = new Map<string, GesendeterHinweis[]>();
  for (const h of hinweise) {
    const schluessel = `${h.erstelltAm}|${h.vonName}|${h.text}`;
    gruppen.set(schluessel, [...(gruppen.get(schluessel) ?? []), h]);
  }
  return [...gruppen.values()];
}

function sperrStand(s: LiveLeaveBlock, heute: string): { text: string; ton: "warn" | "ok" | "aus" } {
  if (heute < s.startDate) return { text: `ab ${formatDEShort(s.startDate)}`, ton: "warn" };
  if (heute <= s.endDate) return { text: "läuft", ton: "ok" };
  return { text: "vorbei", ton: "aus" };
}

const TON: Record<"ok" | "warn" | "info" | "aus", string> = {
  ok: "bg-ok-bg text-ok-fg",
  warn: "bg-warn-bg text-warn-fg",
  info: "bg-info-bg text-info-fg",
  aus: "bg-surface-sunken text-ink-muted",
};

export function MitteilungenZentrale({ startFilter = "alle" }: { startFilter?: Filter }) {
  const { role } = useSession();
  const fuehrung = role === "admin" || role === "shift_leader";
  const admin = role === "admin";

  const [mitteilungen, setMitteilungen] = useState<LiveAnnouncement[] | null>(null);
  const [hinweise, setHinweise] = useState<GesendeterHinweis[] | null>(null);
  const [sperren, setSperren] = useState<LiveLeaveBlock[] | null>(null);
  const [schichten, setSchichten] = useState<ShiftOption[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(startFilter);
  const [neu, setNeu] = useState<null | "frage" | "personen" | "an_alle" | "sperre">(null);
  const [offen, setOffen] = useState<string | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [, starte] = useTransition();

  const laden = useCallback(async () => {
    setFehler(null);
    const [m, h, s, sch] = await Promise.allSettled([
      fetchAnnouncements(25),
      fuehrung ? fetchGesendeteHinweise(60) : Promise.resolve([]),
      fetchLeaveBlocks(),
      fetchShiftOptions(),
    ]);
    setMitteilungen(m.status === "fulfilled" ? m.value : []);
    setHinweise(h.status === "fulfilled" ? h.value : []);
    setSperren(s.status === "fulfilled" ? s.value : []);
    setSchichten(sch.status === "fulfilled" ? sch.value : []);
    const fehlgeschlagen = [m, h, s].find((r) => r.status === "rejected");
    if (fehlgeschlagen?.status === "rejected") {
      const e = fehlgeschlagen.reason;
      setFehler(e instanceof Error && e.message ? e.message : "Die Daten konnten nicht geladen werden.");
    }
  }, [fuehrung]);

  useEffect(() => {
    // Laden beim Öffnen – setState passiert erst nach den Abfragen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden]);

  const heute = heuteInBerlin();
  const geladen = mitteilungen !== null && hinweise !== null && sperren !== null;

  const eintraege = useMemo<Eintrag[]>(() => {
    if (!geladen) return [];
    const alle: Eintrag[] = [
      ...mitteilungen.map((m) => ({ art: "an_alle" as const, datum: m.createdAt, mitteilung: m })),
      ...gruppiere(hinweise).map((g) => ({ art: "personen" as const, datum: g[0]!.erstelltAm, gruppe: g })),
      // Sperren haben kein Anlagedatum – sie stehen nach ihrem Beginn in der
      // Liste, kommende damit oben.
      ...sperren.map((s) => ({ art: "sperre" as const, datum: `${s.startDate}T00:00:00`, sperre: s })),
    ];
    return alle
      .filter((e) => filter === "alle" || (filter === "sperren" ? e.art === "sperre" : e.art === filter))
      .sort((a, b) => b.datum.localeCompare(a.datum));
  }, [geladen, mitteilungen, hinweise, sperren, filter]);

  function schichtName(id: string | null) {
    if (!id) return "ganzer Betrieb";
    return schichten.find((s) => s.id === id)?.name ?? "Schicht";
  }

  function entferneMitteilung(id: string) {
    setBeschaeftigt(id);
    starte(async () => {
      const r = await retireAnnouncement(id);
      if (r.error) setFehler(r.error);
      setBeschaeftigt(null);
      await laden();
    });
  }

  function entferneSperre(id: string) {
    setBeschaeftigt(id);
    starte(async () => {
      const r = await deleteLeaveBlock(id);
      if (r.error) setFehler(r.error);
      setBeschaeftigt(null);
      await laden();
    });
  }

  function zurueckziehen(id: string) {
    setBeschaeftigt(id);
    starte(async () => {
      try {
        await hinweisZurueckziehen(id);
      } catch (e) {
        setFehler(e instanceof HinweisFehler ? e.message : "Der Hinweis konnte nicht zurückgezogen werden.");
      }
      setBeschaeftigt(null);
      await laden();
    });
  }

  function fertig(text: string) {
    setNeu(null);
    setMeldung(text);
    void laden();
  }

  return (
    // Auf breiten Bildschirmen nicht über die ganze Breite gezogen.
    <div className="max-w-3xl space-y-4" data-mitteilungen>
      {fuehrung ? (
        <Button className="w-full justify-center py-3 text-[15px] sm:w-auto" onClick={() => setNeu("frage")}>
          <Plus className="h-4 w-4" />
          Neue Mitteilung
        </Button>
      ) : null}

      {meldung ? <Alert tone="success">{meldung}</Alert> : null}
      {fehler ? <Alert tone="error">{fehler}</Alert> : null}

      <div role="group" aria-label="Filter" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTER.filter((f) => fuehrung || !f.nurFuehrung).map((f) => (
          <button
            key={f.wert}
            type="button"
            aria-pressed={filter === f.wert}
            onClick={() => setFilter(f.wert)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold",
              filter === f.wert ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!geladen ? (
        <RowSkeleton rows={4} />
      ) : eintraege.length === 0 ? (
        <EmptyState
          title={
            filter === "sperren"
              ? "Keine Urlaubssperren angelegt."
              : filter === "personen"
                ? "Noch keine Hinweise gesendet."
                : filter === "an_alle"
                  ? "Noch keine Mitteilungen veröffentlicht."
                  : "Noch nichts gesendet."
          }
        />
      ) : (
        <ul className="space-y-2.5" aria-label="Mitteilungen">
          {eintraege.map((e) => {
            if (e.art === "an_alle") {
              const m = e.mitteilung;
              return (
                <Zeile
                  key={`a-${m.id}`}
                  art="an_alle"
                  typ={m.level === "warn" ? "An alle · Wichtig" : "An alle"}
                  titel={m.title}
                  unter={m.body || `Steht auf jeder Startseite · ${formatDE(m.createdAt.slice(0, 10))}`}
                  stand={<Marke ton="ok">aktiv</Marke>}
                  aktion={
                    fuehrung ? (
                      <Aktion onClick={() => entferneMitteilung(m.id)} disabled={beschaeftigt === m.id}>
                        Entfernen
                      </Aktion>
                    ) : null
                  }
                />
              );
            }
            if (e.art === "sperre") {
              const s = e.sperre;
              const stand = sperrStand(s, heute);
              return (
                <Zeile
                  key={`s-${s.id}`}
                  art="sperre"
                  typ={`Urlaubssperre · ${schichtName(s.shiftId)}`}
                  titel={`${formatDE(s.startDate)} – ${formatDE(s.endDate)}`}
                  unter={s.reason}
                  stand={<Marke ton={stand.ton}>{stand.text}</Marke>}
                  aktion={
                    admin ? (
                      <Aktion onClick={() => entferneSperre(s.id)} disabled={beschaeftigt === s.id}>
                        Entfernen
                      </Aktion>
                    ) : null
                  }
                />
              );
            }
            const g = e.gruppe;
            const erster = g[0]!;
            const schluessel = `h-${erster.id}`;
            const einzeln = g.length === 1;
            const gelesen = g.filter((h) => h.gelesenAm).length;
            return (
              <Zeile
                key={schluessel}
                art="personen"
                typ={einzeln ? `Hinweis an ${erster.empfaenger}` : `Hinweis an ${g.length} Personen`}
                titel={erster.text}
                unter={`${wannText(erster.erstelltAm)}${erster.vonName ? ` · von ${erster.vonName}` : ""}`}
                stand={
                  einzeln ? (
                    <HinweisStand h={erster} />
                  ) : (
                    <Marke ton={gelesen === g.length ? "ok" : "aus"}>
                      {gelesen} von {g.length} gelesen
                    </Marke>
                  )
                }
                aktion={
                  einzeln ? (
                    !erster.gelesenAm && !erster.zurueckgezogenAm ? (
                      <Aktion onClick={() => zurueckziehen(erster.id)} disabled={beschaeftigt === erster.id}>
                        <Undo2 className="h-3.5 w-3.5" />
                        Zurückziehen
                      </Aktion>
                    ) : null
                  ) : (
                    <Aktion
                      onClick={() => setOffen(offen === schluessel ? null : schluessel)}
                      aria-expanded={offen === schluessel}
                    >
                      Wer?
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", offen === schluessel && "rotate-180")} />
                    </Aktion>
                  )
                }
              >
                {!einzeln && offen === schluessel ? (
                  <ul className="mt-2.5 divide-y divide-line rounded-xl border border-line">
                    {g.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <span className="min-w-0 flex-1 text-[13.5px] font-medium">{h.empfaenger}</span>
                        <HinweisStand h={h} />
                        {!h.gelesenAm && !h.zurueckgezogenAm ? (
                          <Aktion onClick={() => zurueckziehen(h.id)} disabled={beschaeftigt === h.id}>
                            <Undo2 className="h-3.5 w-3.5" />
                            Zurückziehen
                          </Aktion>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Zeile>
            );
          })}
        </ul>
      )}

      {neu === "frage" ? (
        <Blatt titel="An wen?" onClose={() => setNeu(null)}>
          <div className="space-y-2.5" data-an-wen>
            <Wahl
              art="personen"
              titel="Einzelne Personen"
              text="Hinweis erscheint beim nächsten Öffnen der App – mit „gelesen“"
              onClick={() => setNeu("personen")}
            />
            <Wahl
              art="an_alle"
              titel="Alle im Betrieb"
              text="Steht auf jeder Startseite, bis du es entfernst"
              onClick={() => setNeu("an_alle")}
            />
            {admin ? (
              <Wahl
                art="sperre"
                titel="Urlaubssperre"
                text="Zeitraum sperren – in dieser Zeit kein Urlaub"
                onClick={() => setNeu("sperre")}
              />
            ) : null}
          </div>
        </Blatt>
      ) : null}

      {neu === "personen" ? (
        <HinweisSenden
          onClose={() => setNeu(null)}
          onGesendet={(n) => fertig(n === 1 ? "Hinweis gesendet." : `Hinweis an ${n} Personen gesendet.`)}
        />
      ) : null}

      {neu === "an_alle" ? <AnAlleBlatt onClose={() => setNeu(null)} onFertig={fertig} /> : null}
      {neu === "sperre" && admin ? (
        <SperreBlatt schichten={schichten} onClose={() => setNeu(null)} onFertig={fertig} />
      ) : null}
    </div>
  );
}

const ART: Record<"personen" | "an_alle" | "sperre", { icon: typeof Megaphone; farbe: string }> = {
  personen: { icon: MessageSquare, farbe: "bg-info-bg text-info-fg" },
  an_alle: { icon: Megaphone, farbe: "bg-warn-bg text-warn-fg" },
  sperre: { icon: CalendarOff, farbe: "bg-crit-bg text-crit-fg" },
};

function ArtIcon({ art }: { art: keyof typeof ART }) {
  const { icon: Icon, farbe } = ART[art];
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", farbe)}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
    </span>
  );
}

function Zeile({
  art,
  typ,
  titel,
  unter,
  stand,
  aktion,
  children,
}: {
  art: keyof typeof ART;
  typ: string;
  titel: string;
  unter?: string;
  stand: React.ReactNode;
  aktion: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li data-eintrag={art} className="rounded-[18px] border border-line bg-surface px-3.5 py-3 shadow-card">
      <div className="flex gap-3">
        <ArtIcon art={art} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-[12.5px] font-semibold text-ink-muted">{typ}</p>
            <span className="shrink-0">{stand}</span>
          </div>
          <p className="mt-0.5 break-words text-[15px] font-semibold leading-snug">{titel}</p>
          <div className="flex items-end justify-between gap-2">
            {unter ? <p className="mt-0.5 min-w-0 break-words text-[13px] leading-snug text-ink-muted">{unter}</p> : <span />}
            {aktion ? <div className="-mb-1 -mr-1.5 shrink-0">{aktion}</div> : null}
          </div>
          {children}
        </div>
      </div>
    </li>
  );
}

function Marke({ ton, children }: { ton: keyof typeof TON; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold", TON[ton])}>
      {children}
    </span>
  );
}

function Aktion({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Stand eines Hinweises – dieselben Stufen wie bisher. */
function HinweisStand({ h }: { h: GesendeterHinweis }) {
  if (h.zurueckgezogenAm) return <Marke ton="aus">zurückgezogen</Marke>;
  if (h.gelesenAm)
    return (
      <Marke ton="ok">
        <Check className="h-3 w-3" />
        gelesen {wannText(h.gelesenAm)}
      </Marke>
    );
  if (h.pushGesendet)
    return (
      <Marke ton="info">
        <Smartphone className="h-3 w-3" />
        aufs Handy geschickt
      </Marke>
    );
  if (h.pushAb && new Date(h.pushAb) > new Date())
    return (
      <Marke ton="warn">
        <Clock className="h-3 w-3" />
        {h.push === "schicht" ? "kommt" : "Handy"} {wannText(h.pushAb)}
      </Marke>
    );
  return <Marke ton="aus">noch nicht gelesen</Marke>;
}

function Wahl({ art, titel, text, onClick }: { art: keyof typeof ART; titel: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-3.5 py-3 text-left hover:bg-surface-muted"
    >
      <ArtIcon art={art} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-semibold">{titel}</span>
        <span className="block text-[13px] leading-snug text-ink-muted">{text}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
    </button>
  );
}

const leer: FormState = {};

/** Nach dem Speichern genau einmal melden – auch wenn die Eltern neu zeichnen. */
function useFertig(stand: FormState, onFertig: (text: string) => void) {
  const gemeldet = useRef(false);
  useEffect(() => {
    if (stand.success && !gemeldet.current) {
      gemeldet.current = true;
      onFertig(stand.success);
    }
  }, [stand.success, onFertig]);
}

function AnAlleBlatt({ onClose, onFertig }: { onClose: () => void; onFertig: (text: string) => void }) {
  const [stand, formAction] = useActionState(createAnnouncement, leer);
  const [titel, setTitel] = useState("");
  const [text, setText] = useState("");
  const [wichtig, setWichtig] = useState(false);

  useFertig(stand, onFertig);

  return (
    <Blatt titel="An alle im Betrieb" unter="Steht auf jeder Startseite, bis du es entfernst." onClose={onClose} wischZu="kopf">
      <form action={formAction} className="space-y-3" data-an-alle>
        <input type="hidden" name="level" value={wichtig ? "warn" : "info"} />
        <Field label="Titel">
          <Input
            name="title"
            maxLength={120}
            placeholder="z. B. Wartung Anlage 3"
            required
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
          />
        </Field>
        <Field label="Text (optional)">
          <textarea
            name="body"
            rows={3}
            maxLength={2000}
            placeholder="Kurze Erklärung für die Schichten"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-faint"
          />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-medium">Wie wichtig?</p>
          <div className="flex rounded-full border border-line bg-surface p-1" role="radiogroup" aria-label="Wie wichtig?">
            {[
              { wert: false, label: "Hinweis" },
              { wert: true, label: "Wichtig" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={wichtig === o.wert}
                onClick={() => setWichtig(o.wert)}
                className={cn(
                  "flex-1 rounded-full py-2 text-[14px] font-semibold",
                  wichtig === o.wert ? "bg-brand-600 text-white" : "text-ink-muted",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {titel.trim() ? (
          <div className="rounded-xl bg-surface-muted px-3.5 py-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">So sieht es auf der Startseite aus</p>
            <div className="flex gap-2.5">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", wichtig ? "bg-warn-dot" : "bg-info-dot")} />
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{titel}</p>
                {text.trim() ? <p className="break-words text-[13px] leading-snug text-ink-muted">{text}</p> : null}
              </div>
            </div>
          </div>
        ) : null}
        {stand.error ? <Alert tone="error">{stand.error}</Alert> : null}
        <Senden text="Veröffentlichen" laeuft="Wird veröffentlicht …" />
      </form>
    </Blatt>
  );
}

function SperreBlatt({
  schichten,
  onClose,
  onFertig,
}: {
  schichten: ShiftOption[];
  onClose: () => void;
  onFertig: (text: string) => void;
}) {
  const [stand, formAction] = useActionState(createLeaveBlock, leer);

  useFertig(stand, onFertig);

  return (
    <Blatt titel="Urlaubssperre" unter="In diesem Zeitraum kann kein Urlaub beantragt werden." onClose={onClose} wischZu="kopf">
      <form action={formAction} className="space-y-3" data-sperre-form>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Von">
            <Input type="date" name="start_date" required />
          </Field>
          <Field label="Bis">
            <Input type="date" name="end_date" required />
          </Field>
        </div>
        <Field label="Für wen?">
          <select name="shift_id" className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
            <option value="">Ganzer Betrieb</option>
            {schichten.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Grund">
          <Input name="reason" placeholder="z. B. Betriebsferien" required />
        </Field>
        {stand.error ? <Alert tone="error">{stand.error}</Alert> : null}
        <Senden text="Sperre anlegen" laeuft="Wird gespeichert …" />
      </form>
    </Blatt>
  );
}

function Senden({ text, laeuft }: { text: string; laeuft: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full justify-center py-3 text-[15px]">
      {pending ? laeuft : text}
    </Button>
  );
}
