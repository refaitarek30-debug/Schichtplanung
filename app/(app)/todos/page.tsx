import type { Metadata } from "next";
import { PrivatTodos } from "@/components/privat/todos";

export const metadata: Metadata = { title: "To-dos – ShiftNexo" };

/**
 * To-dos im Betrieb – dieselbe Liste wie im Privatbereich (Filter, Suche,
 * Bearbeiten, Erinnerung). Die Daten liegen je Person in `kalender_todos`
 * (Migration 0154); sehen kann sie nur die Person selbst.
 */
export default function TodosSeite() {
  return (
    <div className="privat-schrift mx-auto w-full max-w-3xl">
      <PrivatTodos />
    </div>
  );
}
