"use client";

import { ListChecks } from "lucide-react";
import type { Todo } from "@/lib/data/todos";

/** Offene To-dos, die heute dran oder überfällig sind – ohne Tag zählt nicht. */
export function offeneBisHeute(todos: Todo[], heute: string): number {
  return todos.filter((t) => !t.erledigt && t.datum !== null && t.datum <= heute).length;
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
