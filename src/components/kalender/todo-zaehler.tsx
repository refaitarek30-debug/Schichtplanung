"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { fetchTodos, type Todo } from "@/lib/data/todos";
import { heuteInBerlin } from "@/lib/dates";

/** Offene To-dos, die heute dran oder überfällig sind – ohne Tag zählt nicht. */
export function offeneBisHeute(todos: Todo[], heute: string): number {
  return todos.filter((t) => !t.erledigt && t.datum !== null && t.datum <= heute).length;
}

/** Offene To-dos bis heute – für die Zahl am Reiter; lädt neu bei Seitenwechsel und wenn sich To-dos ändern. */
export function useTodoZahl(pfad: string): number {
  const [zahl, setZahl] = useState(0);
  useEffect(() => {
    let aktiv = true;
    const laden = () => {
      fetchTodos()
        .then((t) => aktiv && setZahl(offeneBisHeute(t, heuteInBerlin())))
        .catch(() => {});
    };
    laden();
    window.addEventListener("todos-geaendert", laden);
    return () => {
      aktiv = false;
      window.removeEventListener("todos-geaendert", laden);
    };
  }, [pfad]);
  return zahl;
}

/** Kleine rote Zahl am Reiter „To-dos“ – ohne offene To-dos steht nichts da. */
export function TodoZahlMarke({ pfad, className }: { pfad: string; className?: string }) {
  const zahl = useTodoZahl(pfad);
  if (!zahl) return null;
  return (
    <span
      aria-label={`${zahl} offen`}
      className={
        "tnum flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-crit-dot px-1 text-[10.5px] font-bold leading-none text-white " +
        (className ?? "")
      }
    >
      {zahl > 99 ? "99+" : zahl}
    </span>
  );
}

/**
 * Haken mit Zahl oben im Kalender. Antippen öffnet die To-do-Liste. Ohne
 * offene To-dos steht nur der Haken da.
 */
export function TodoZaehler({ anzahl, onClick }: { anzahl: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={anzahl ? `To-dos öffnen, ${anzahl} offen` : "To-dos öffnen"}
      title="To-dos"
      className="glas flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-ok-fg [@media(max-width:360px)]:h-9 [@media(max-width:360px)]:min-w-9 [@media(max-width:360px)]:px-2"
    >
      <ListChecks className="h-[19px] w-[19px]" strokeWidth={2.2} />
      {anzahl ? <span className="tnum text-[15px] font-bold leading-none">{anzahl}</span> : null}
    </button>
  );
}
