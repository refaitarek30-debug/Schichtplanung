import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

export class DataError extends Error {}

/** Abdeckung einer Funktion in einer Schicht an einem Tag. */
export interface CoverageRecord {
  qualificationId: string;
  label: string;
  benoetigt: number;
  vorhanden: number;
  fehlt: number;
}

/**
 * Wie gut eine Schicht an einem Tag je Funktion besetzt ist.
 *
 * Die vorhandene Prüfung zählt nur Köpfe gegen `minimum_staff`. Das
 * reicht nicht: eine Schicht kann vollzählig sein und trotzdem niemanden
 * mit B-Schein haben.
 */
export async function fetchCoverage(shiftId: string, date: string): Promise<CoverageRecord[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("qualification_coverage", {
    p_shift_id: shiftId,
    p_date: date,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  return ((data ?? []) as {
    qualification_id: string;
    label: string;
    benoetigt: number;
    vorhanden: number;
    fehlt: number;
  }[]).map((row) => ({
    qualificationId: row.qualification_id,
    label: row.label,
    benoetigt: Number(row.benoetigt),
    vorhanden: Number(row.vorhanden),
    fehlt: Number(row.fehlt),
  }));
}

/**
 * Eine mögliche Ersatzkraft samt Begründung.
 *
 * Auch wer nicht in Frage kommt, steht in der Liste – sonst wüsste
 * niemand, warum eine naheliegende Person fehlt. `auswaehlbar` sagt, ob
 * angefragt werden darf, `grund` sagt warum nicht.
 */
export interface CandidateRecord {
  employeeId: string;
  name: string;
  rotationTeam: string | null;
  eigeneSchicht: boolean;
  hatQualifikation: boolean;
  beschaeftigt: boolean;
  frei: boolean;
  ohneUeberschneidung: boolean;
  ruhezeitStunden: number | null;
  ruhezeitOk: boolean;
  dauerStunden: number | null;
  dauerOk: boolean;
  auswaehlbar: boolean;
  grund: string;
}

export async function fetchCandidates(
  date: string,
  shiftId: string,
  qualificationId: string | null,
): Promise<CandidateRecord[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("replacement_candidates", {
    p_date: date,
    p_shift_id: shiftId,
    p_qualification_id: qualificationId,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    employeeId: String(row.employee_id),
    name: String(row.name),
    rotationTeam: (row.rotation_team as string) ?? null,
    eigeneSchicht: Boolean(row.eigene_schicht),
    hatQualifikation: Boolean(row.hat_qualifikation),
    beschaeftigt: Boolean(row.beschaeftigt),
    frei: Boolean(row.frei),
    ohneUeberschneidung: Boolean(row.ohne_ueberschneidung),
    ruhezeitStunden: row.ruhezeit_stunden === null ? null : Number(row.ruhezeit_stunden),
    ruhezeitOk: Boolean(row.ruhezeit_ok),
    dauerStunden: row.dauer_stunden === null ? null : Number(row.dauer_stunden),
    dauerOk: Boolean(row.dauer_ok),
    auswaehlbar: Boolean(row.auswaehlbar),
    grund: String(row.grund),
  }));
}

/** Eine gestellte Anfrage mit ihrem Stand. */
export interface ReplacementRequestRecord {
  id: string;
  date: string;
  shiftId: string;
  askedEmployeeId: string;
  status: "offen" | "angenommen" | "abgelehnt" | "zurueckgezogen";
  answeredAt: string | null;
  assignedAt: string | null;
  answerNote: string | null;
}

export async function fetchReplacementRequests(
  date: string,
  shiftId: string,
): Promise<ReplacementRequestRecord[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("replacement_requests")
    .select("id, date, shift_id, asked_employee_id, status, answered_at, assigned_at, answer_note")
    .eq("date", date)
    .eq("shift_id", shiftId);
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    date: String(row.date),
    shiftId: String(row.shift_id),
    askedEmployeeId: String(row.asked_employee_id),
    status: row.status as ReplacementRequestRecord["status"],
    answeredAt: (row.answered_at as string) ?? null,
    assignedAt: (row.assigned_at as string) ?? null,
    answerNote: (row.answer_note as string) ?? null,
  }));
}

/** Eine an mich gerichtete, noch offene Anfrage – mit allem zum Entscheiden. */
export interface MyReplacementRequest {
  id: string;
  date: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  note: string | null;
  qualificationLabel: string | null;
}

/**
 * Offene Ersatzanfragen an die angemeldete Person.
 *
 * Der Filter auf die eigene Person ist hier **nicht** nur Kosmetik: die
 * Policy lässt die Führung alle Anfragen des Unternehmens lesen, damit
 * sie den Stand verfolgen kann. Ohne den Filter bekäme eine
 * Schichtleiterin fremde Anfragen zum Beantworten angeboten – das
 * Beantworten selbst weist die Datenbank zwar ab, aber die Liste wäre
 * schon falsch.
 */
export async function fetchMyOpenRequests(
  employeeId: string,
): Promise<MyReplacementRequest[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("replacement_requests")
    .select(
      "id, date, note, shifts ( name, start_time, end_time ), qualifications ( label )",
    )
    .eq("status", "offen")
    .eq("asked_employee_id", employeeId)
    .order("date", { ascending: true });

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const schicht = (Array.isArray(row.shifts) ? row.shifts[0] : row.shifts) as
      | { name: string; start_time: string; end_time: string }
      | null;
    const qual = (Array.isArray(row.qualifications) ? row.qualifications[0] : row.qualifications) as
      | { label: string }
      | null;
    return {
      id: String(row.id),
      date: String(row.date),
      shiftName: schicht?.name ?? "Schicht",
      startTime: schicht?.start_time?.slice(0, 5) ?? "",
      endTime: schicht?.end_time?.slice(0, 5) ?? "",
      note: (row.note as string) ?? null,
      qualificationLabel: qual?.label ?? null,
    };
  });
}
