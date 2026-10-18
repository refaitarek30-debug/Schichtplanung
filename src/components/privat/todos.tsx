"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { ErinnerungHinweis } from "@/components/kalender/erinnerungen";
import { fetchTodos, todoErledigt, todoLoeschen, todoSpeichern, type Todo } from "@/lib/data/todos";
import { addDays, formatDE, fromISO, heuteInBerlin } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Blatt } from "./blatt";
import { PrivatKopf, RundKnopf } from "./rahmen";

/**
 * To-dos als eigener Reiter: neu schreiben, nach Tag filtern, suchen, abhaken
 * und nachträglich bearbeiten. Die Daten sind dieselben wie im Kalender
 * (Migration 0154) – sie sieht nur die Person selbst.
 */

type Filter = "alle" | "heute" | "woche" | "ueber" | "ohne" | "fertig";

const FILTER: { id: Filter; name: string }[] = [
  { id: "alle", name: "Alle" },
  { id: "heute", name: "Heute" },
  { id: "woche", name: "Woche" },
  { id: "ueber", name: "Überfällig" },
  { id: "ohne", name: "Ohne Tag" },
  { id: "fertig", name: "Erledigt" },
];

const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const kurz = (iso: string) => `${WT[fromISO(iso).getDay()]} ${formatDE(iso).slice(0, 6)}`;

function passt(t: Todo, f: Filter, heute: string): boolean {
  const ende = addDays(heute, 7);
  switch (f) {
    case "alle":
      return !t.erledigt;
    case "heute":
      return !t.erledigt && t.datum === heute;
    case "woche":
      return !t.erledigt && !!t.datum && t.datum >= heute && t.datum <= ende;
    case "ueber":
      return !t.erledigt && !!t.datum && t.datum < heute;
    case "ohne":
      return !t.erledigt && !t.datum;
    case "fertig":
      return t.erledigt;
  }
}

function sortiert(liste: Todo[]): Todo[] {
  return [...liste].sort(
    (a, b) => (a.datum ?? "9999").localeCompare(b.datum ?? "9999") || (a.uhrzeit ?? "99").localeCompare(b.uhrzeit ?? "99"),
  );
}

export function PrivatTodos() {
  const heute = heuteInBerlin();
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("alle");
  const [suche, setSuche] = useState("");
  const [sucheAuf, setSucheAuf] = useState(false);
  const [text, setText] = useState("");
  const [bearbeiten, setBearbeiten] = useState<Todo | null>(null);
  // Eben abgehakte To-dos bleiben stehen, bis der Filter wechselt – so lässt sich ein Tippfehler gleich zurücknehmen.
  const [eben, setEben] = useState<ReadonlySet<string>>(new Set());

  const laden = useCallback(async () => {
    try {
      setTodos(await fetchTodos());
      setFehler(null);
    } catch (e) {
      setTodos((alt) => alt ?? []);
      setFehler(e instanceof Error ? e.message : "Die To-dos konnten nicht geladen werden.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return (todos ?? []).filter((t) => (passt(t, filter, heute) || eben.has(t.id)) && (!q || t.titel.toLowerCase().includes(q)));
  }, [todos, filter, suche, heute, eben]);

  const offenHeute = (todos ?? []).filter((t) => passt(t, "heute", heute) || passt(t, "ueber", heute)).length;

  async function neu() {
    const titel = text.trim();
    if (!titel) return;
    setText("");
    try {
      await todoSpeichern({ id: null, titel, datum: filter === "ohne" ? null : heute, uhrzeit: null });
      setFehler(null);
    } catch (e) {
      setText(titel);
      setFehler(e instanceof Error ? e.message : "Das To-do konnte nicht gespeichert werden.");
    }
    await laden();
  }

  async function haken(t: Todo, an: boolean) {
    setEben((alt) => new Set(alt).add(t.id));
    setTodos((alt) => (alt ?? []).map((x) => (x.id === t.id ? { ...x, erledigt: an } : x)));
    try {
      await todoErledigt(t.id, an);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      await laden();
    }
  }

  async function speichern(t: Todo) {
    setBearbeiten(null);
    try {
      await todoSpeichern({ id: t.id, titel: t.titel, datum: t.datum, uhrzeit: t.uhrzeit });
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das To-do konnte nicht gespeichert werden.");
    }
    await laden();
  }

  async function loeschen(t: Todo) {
    setBearbeiten(null);
    setTodos((alt) => (alt ?? []).filter((x) => x.id !== t.id));
    try {
      await todoLoeschen(t.id);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das To-do konnte nicht gelöscht werden.");
      await laden();
    }
  }

  const gruppen: { titel: string; ueber?: boolean; liste: Todo[] }[] =
    filter === "alle" || filter === "woche"
      ? [
          { titel: "Überfällig", ueber: true, liste: gefiltert.filter((t) => t.datum && t.datum < heute) },
          { titel: "Heute", liste: gefiltert.filter((t) => t.datum === heute) },
          { titel: "Diese Woche", liste: gefiltert.filter((t) => t.datum && t.datum > heute && t.datum <= addDays(heute, 7)) },
          { titel: "Später", liste: gefiltert.filter((t) => t.datum && t.datum > addDays(heute, 7)) },
          { titel: "Irgendwann", liste: gefiltert.filter((t) => !t.datum) },
        ]
      : [{ titel: "", liste: gefiltert }];

  return (
    <div className="space-y-3">
      <PrivatKopf
        titel="To-dos"
        unter={todos ? (offenHeute ? `${offenHeute} offen für heute` : "Heute ist alles erledigt 🎉") : "Lädt …"}
        rechts={
          <RundKnopf label="Suchen" aktiv={sucheAuf} onClick={() => (setSucheAuf((a) => !a), setSuche(""))}>
            <Search className="h-5 w-5" />
          </RundKnopf>
        }
      />

      {fehler ? <Alert tone="error">{fehler}</Alert> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void neu();
        }}
        className="flex items-center gap-2"
      >
        <input
          id="todo-neu"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Neues To-do …"
          maxLength={120}
          autoComplete="off"
          aria-label="Neues To-do"
          className="glas h-12 min-w-0 flex-1 rounded-[15px] px-3.5 text-[16px] outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-brand-500/40"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Hinzufügen"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-ink text-surface disabled:bg-ink/10 disabled:text-ink-muted"
        >
          <Plus className="h-5 w-5" strokeWidth={2.6} />
        </button>
      </form>

      {sucheAuf ? (
        <div className="glas flex h-11 items-center gap-2 rounded-[15px] px-3">
          <Search className="h-[18px] w-[18px] shrink-0 text-ink-muted" />
          <input
            id="todo-suche"
            autoFocus
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="To-dos durchsuchen"
            aria-label="To-dos durchsuchen"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-faint"
          />
        </div>
      ) : null}

      <div role="group" aria-label="Filter" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTER.map((f) => {
          const n = (todos ?? []).filter((t) => passt(t, f.id, heute)).length;
          const an = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={an}
              onClick={() => (setFilter(f.id), setEben(new Set()))}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold",
                an ? "bg-ink text-surface" : f.id === "ueber" && n ? "bg-crit-bg text-crit-fg" : "bg-ink/[0.06] text-ink",
              )}
            >
              {f.name}
              <span className="tnum text-[12px] opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <div aria-busy={!todos} className="space-y-3">
        {gruppen
          .filter((g) => g.liste.length)
          .map((g) => (
            <section key={g.titel || "liste"} aria-label={g.titel || undefined}>
              {g.titel ? (
                <p className={cn("mb-1.5 flex items-center gap-1.5 px-1 text-[12px] font-bold uppercase tracking-[0.06em]", g.ueber ? "text-crit-fg" : "text-ink-muted")}>
                  {g.titel}
                  <span className="tnum rounded-lg bg-ink/[0.07] px-1.5 text-[11px] normal-case tracking-normal">{g.liste.length}</span>
                </p>
              ) : null}
              <ul className="space-y-1.5">
                {sortiert(g.liste).map((t) => {
                  const ueber = !!t.datum && t.datum < heute && !t.erledigt;
                  return (
                    <li key={t.id} className="glas flex items-center gap-1 rounded-[16px] py-1 pl-1 pr-1.5">
                      <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={t.erledigt}
                          onChange={(e) => void haken(t, e.target.checked)}
                          aria-label={`${t.titel} erledigt`}
                          className="h-6 w-6 accent-[#22A06B]"
                        />
                      </label>
                      <button type="button" onClick={() => setBearbeiten(t)} className="min-w-0 flex-1 py-1.5 text-left">
                        <span className={cn("block truncate text-[16px] font-semibold", t.erledigt && "text-ink-faint line-through")}>{t.titel}</span>
                        <span className={cn("tnum block text-[12.5px] font-semibold", ueber ? "text-crit-fg" : "text-ink-muted")}>
                          {!t.datum
                            ? "Ohne Tag"
                            : t.datum === heute
                              ? "Heute"
                              : `${ueber ? "Überfällig · " : ""}${kurz(t.datum)}`}
                          {t.uhrzeit ? ` · 🔔 ${t.uhrzeit}` : ""}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBearbeiten(t)}
                        aria-label={`${t.titel} bearbeiten`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint active:bg-ink/10"
                      >
                        <Pencil className="h-[18px] w-[18px]" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        {todos && !gefiltert.length ? (
          <p className="px-4 py-8 text-center text-[14.5px] text-ink-muted">
            {suche.trim()
              ? "Nichts gefunden."
              : filter === "alle"
                ? "Alles erledigt 🎉 Schreib oben ein neues To-do."
                : "Hier ist nichts. Probier einen anderen Filter."}
          </p>
        ) : null}
      </div>

      {bearbeiten ? (
        <TodoBearbeiten key={bearbeiten.id} todo={bearbeiten} heute={heute} onSpeichern={(t) => void speichern(t)} onLoeschen={(t) => void loeschen(t)} onClose={() => setBearbeiten(null)} />
      ) : null}
    </div>
  );
}

function TodoBearbeiten({
  todo,
  heute,
  onSpeichern,
  onLoeschen,
  onClose,
}: {
  todo: Todo;
  heute: string;
  onSpeichern: (t: Todo) => void;
  onLoeschen: (t: Todo) => void;
  onClose: () => void;
}) {
  const [titel, setTitel] = useState(todo.titel);
  const [datum, setDatum] = useState<string | null>(todo.datum);
  const [uhrzeit, setUhrzeit] = useState(todo.uhrzeit ?? "");

  const wahl: { wert: string | null; name: string }[] = [
    { wert: heute, name: "Heute" },
    { wert: addDays(heute, 1), name: "Morgen" },
    { wert: addDays(heute, 3), name: kurz(addDays(heute, 3)) },
    { wert: null, name: "Ohne Tag" },
  ];
  const eigener = datum !== null && !wahl.some((w) => w.wert === datum);
  const gueltig = titel.trim().length > 0;

  return (
    <Blatt
      wischZu="kopf"
      titel="To-do bearbeiten"
      unter={datum ? formatDE(datum) : "Ohne Tag"}
      onClose={onClose}
      fuss={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onLoeschen(todo)}
            className="flex h-12 items-center justify-center gap-1.5 rounded-[15px] bg-crit-bg text-[15px] font-bold text-crit-fg"
          >
            <Trash2 className="h-[18px] w-[18px]" /> Löschen
          </button>
          <button
            type="button"
            disabled={!gueltig}
            onClick={() => onSpeichern({ ...todo, titel: titel.trim(), datum, uhrzeit: datum && uhrzeit ? uhrzeit : null })}
            className="h-12 rounded-[15px] bg-ink text-[15px] font-bold text-surface disabled:opacity-40"
          >
            Speichern
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">Titel</span>
          <input
            id="todo-titel"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            maxLength={120}
            className="h-12 w-full rounded-[15px] bg-ink/[0.06] px-3.5 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          />
        </label>
        <div>
          <span className="mb-1 block text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">Tag</span>
          <div className="flex flex-wrap gap-1.5">
            {wahl.map((w) => (
              <button
                key={w.name}
                type="button"
                aria-pressed={datum === w.wert}
                onClick={() => setDatum(w.wert)}
                className={cn("h-9 rounded-full px-3.5 text-[13.5px] font-semibold", datum === w.wert ? "bg-ink text-surface" : "bg-ink/[0.06] text-ink")}
              >
                {w.name}
              </button>
            ))}
            <label className={cn("flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold", eigener ? "bg-ink text-surface" : "bg-ink/[0.06] text-ink")}>
              Anderer Tag
              <input
                id="todo-datum"
                type="date"
                value={datum ?? ""}
                onChange={(e) => setDatum(e.target.value || null)}
                aria-label="Anderer Tag"
                className="w-[7.4rem] bg-transparent text-[13px] outline-none [color-scheme:inherit]"
              />
            </label>
          </div>
        </div>
        {datum ? (
          <label className="block">
            <span className="mb-1 block text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">🔔 Erinnern um</span>
            <input
              id="todo-uhrzeit"
              type="time"
              value={uhrzeit}
              onChange={(e) => setUhrzeit(e.target.value)}
              className="h-12 w-full rounded-[15px] bg-ink/[0.06] px-3.5 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            />
          </label>
        ) : null}
        {datum && uhrzeit ? <ErinnerungHinweis /> : null}
      </div>
    </Blatt>
  );
}
