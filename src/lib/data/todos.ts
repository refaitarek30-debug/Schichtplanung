import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage, datenFehlerText } from "@/lib/errors";
import { imBetrieb } from "@/lib/bereich";

/**
 * To-dos und Vorlieben im Kalender – Migration 0154. Beides sieht nur die
 * Person selbst; die Firma und Eingeladene sehen nichts davon.
 */

export interface Todo {
  id: string;
  titel: string;
  /** Tag, "YYYY-MM-DD" – ohne Tag steht es unter „Irgendwann“. */
  datum: string | null;
  /** Uhrzeit für die Erinnerung, "HH:MM". */
  uhrzeit: string | null;
  erledigt: boolean;
}

class KalenderFehler extends Error {}

/** Sagt der Leiste unten, dass sich die To-dos geändert haben (Zahl am Reiter). */
function geaendert() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("todos-geaendert"));
}

function fehler(error: Parameters<typeof dataErrorMessage>[0], standard: string): never {
  throw new KalenderFehler(datenFehlerText(error, standard));
}

export async function fetchTodos(): Promise<Todo[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createClient().rpc("meine_todos");
  if (error) fehler(error, "Die To-dos konnten nicht geladen werden.");
  // Beim Beitritt nicht übernommene To-dos bleiben im Privatbereich.
  const betrieb = imBetrieb();
  return ((data ?? []) as { id: string; titel: string; datum: string | null; uhrzeit: string | null; erledigt: boolean; nur_privat?: boolean }[])
    .filter((z) => !(betrieb && z.nur_privat))
    .map((z) => ({ id: z.id, titel: z.titel, datum: z.datum, uhrzeit: z.uhrzeit, erledigt: z.erledigt }));
}

export async function todoSpeichern(t: { id: string | null; titel: string; datum: string | null; uhrzeit: string | null }) {
  const { data, error } = await createClient().rpc("todo_speichern", {
    p_id: t.id,
    p_titel: t.titel,
    p_datum: t.datum,
    p_uhrzeit: t.datum ? t.uhrzeit : null,
  });
  if (error) fehler(error, "Das To-do konnte nicht gespeichert werden.");
  geaendert();
  return data as string;
}

export async function todoErledigt(id: string, an: boolean) {
  const { error } = await createClient().rpc("todo_erledigt", { p_id: id, p_an: an });
  if (error) fehler(error, "Das hat nicht geklappt.");
  geaendert();
}

export async function todoLoeschen(id: string) {
  const { error } = await createClient().rpc("todo_loeschen", { p_id: id });
  if (error) fehler(error, "Das To-do konnte nicht gelöscht werden.");
  geaendert();
}

/** Offene To-dos an einem Tag, nach Uhrzeit. */
export function todosAm(todos: Todo[], iso: string): Todo[] {
  return todos
    .filter((t) => t.datum === iso)
    .sort((a, b) => Number(a.erledigt) - Number(b.erledigt) || (a.uhrzeit ?? "99").localeCompare(b.uhrzeit ?? "99"));
}

// ---- Vorlieben ------------------------------------------------------------------

export type Rolle = "schule" | "studium" | "job" | "schicht" | "eltern" | "anders";

export interface Vorlage {
  icon: string;
  titel: string;
  /** Dauer in Minuten; 0 = ganztägig. */
  min: number;
  /** Jedes Jahr wiederholen (z. B. Geburtstag). */
  jaehrlich?: boolean;
}

export interface Vorlieben {
  rollen: Rolle[];
  vorlagen: Vorlage[];
  /** Schon einmal gefragt („Was passt zu dir?“). */
  gefragt: boolean;
}

export const LEERE_VORLIEBEN: Vorlieben = { rollen: [], vorlagen: [], gefragt: false };

export async function fetchVorlieben(): Promise<Vorlieben> {
  if (!isSupabaseConfigured) return LEERE_VORLIEBEN;
  const { data, error } = await createClient().rpc("meine_vorlieben");
  if (error) fehler(error, "Die Einstellungen konnten nicht geladen werden.");
  const v = (data ?? {}) as Partial<Vorlieben>;
  return {
    rollen: Array.isArray(v.rollen) ? v.rollen : [],
    vorlagen: Array.isArray(v.vorlagen) ? v.vorlagen : [],
    gefragt: v.gefragt === true,
  };
}

/** null = unverändert lassen. */
export async function vorliebenSetzen(rollen: Rolle[] | null, vorlagen: Vorlage[] | null) {
  const { error } = await createClient().rpc("vorlieben_setzen", { p_rollen: rollen, p_vorlagen: vorlagen });
  if (error) fehler(error, "Das konnte nicht gespeichert werden.");
}
