"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import { addDays } from "@/lib/dates";
import { leaveKindLabels, type LeaveKind } from "@/lib/types";
import type { FormState } from "./form-state";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Im produktiven Betrieb ist der Backend-Zugriff erforderlich.",
};

/**
 * Teilt einen Mitarbeiter für einen einzelnen Tag einer Schicht zu – als
 * Ausnahme von der festen Zuordnung (`employees.shift_id`). Leeres
 * `shift_id` heißt: der Tag ist ausdrücklich frei.
 *
 * `plan_set_shift()` räumt dabei den Tag frei: ein Urlaubstag, V-Tag oder
 * eine Abwesenheit an genau diesem Tag fällt weg, denn wer eingeteilt ist,
 * arbeitet. Ohne das blieb die Abwesenheit stehen und überdeckte die neue
 * Schicht in der Matrix – die Zuordnung wurde gespeichert, sah aber aus,
 * als wäre nichts passiert.
 */
export async function assignShift(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const employeeId = String(formData.get("employee_id") ?? "");
  const shiftId = String(formData.get("shift_id") ?? "");
  const date = String(formData.get("date") ?? "");

  if (!employeeId || !date) {
    return { error: "Bitte Mitarbeiter und Datum auswählen." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("plan_set_shift", {
    p_employee_id: employeeId,
    p_shift_id: shiftId || null,
    p_date: date,
  });

  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Zuordnung konnte nicht gespeichert werden." };
  }

  revalidatePath("/verwaltung");
  revalidatePath("/besetzung");
  revalidatePath("/schichtplan");
  revalidatePath("/meine-schichten");
  return { success: "Zuordnung gespeichert." };
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WECHSEL_TAGE = 62;

/**
 * Schichtwechsel über einen Zeitraum: jeden Tag von–bis in die gewählte
 * Schicht setzen.
 *
 * Anders als der Tipp auf eine einzelne Zelle überschreibt das keinen
 * Urlaub und keine Abwesenheit: `plan_set_shift()` würde sie an dem Tag
 * löschen, und über zwei Wochen wäre ein genehmigter Urlaub unbemerkt weg.
 * Solche Tage werden übersprungen und in der Meldung genannt.
 */
export async function assignShiftRange(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const employeeId = String(formData.get("employee_id") ?? "");
  const shiftId = String(formData.get("shift_id") ?? "");
  const from = String(formData.get("date_from") ?? "");
  const to = String(formData.get("date_to") ?? "") || from;
  const kommentar = String(formData.get("note") ?? "").trim();

  if (!employeeId || !DATUM.test(from) || !DATUM.test(to)) {
    return { error: "Bitte Mitarbeiter und Zeitraum auswählen." };
  }
  if (!shiftId) return { error: "Bitte die neue Schicht auswählen." };
  if (to < from) return { error: "Das Ende darf nicht vor dem Beginn liegen." };
  if (kommentar.length > 500) return { error: "Der Kommentar ist zu lang (höchstens 500 Zeichen)." };

  const tage: string[] = [];
  for (let tag = from; tag <= to; tag = addDays(tag, 1)) {
    tage.push(tag);
    if (tage.length > MAX_WECHSEL_TAGE) {
      return { error: `Ein Schichtwechsel geht über höchstens ${MAX_WECHSEL_TAGE} Tage.` };
    }
  }

  const supabase = await createClient();
  const [abwesend, antraege] = await Promise.all([
    supabase.from("absences").select("date").eq("employee_id", employeeId).gte("date", from).lte("date", to),
    supabase
      .from("leave_requests")
      .select("start_date, end_date")
      .eq("employee_id", employeeId)
      .in("status", ["pending", "approved"])
      .lte("start_date", to)
      .gte("end_date", from),
  ]);
  if (abwesend.error || antraege.error) {
    return {
      error:
        dataErrorMessage(abwesend.error ?? antraege.error) ??
        "Der Plan der Person konnte nicht geprüft werden.",
    };
  }

  const belegt = new Set<string>((abwesend.data ?? []).map((a: { date: string }) => a.date));
  for (const antrag of (antraege.data ?? []) as { start_date: string; end_date: string }[]) {
    for (let tag = antrag.start_date; tag <= antrag.end_date; tag = addDays(tag, 1)) belegt.add(tag);
  }

  let gesetzt = 0;
  let ersterTag: string | null = null;
  for (const tag of tage.filter((t) => !belegt.has(t))) {
    const { error } = await supabase.rpc("plan_set_shift", {
      p_employee_id: employeeId,
      p_shift_id: shiftId,
      p_date: tag,
    });
    if (error) {
      const grund = dataErrorMessage(error) ?? "Der Schichtwechsel konnte nicht gespeichert werden.";
      return {
        error: gesetzt > 0 ? `${grund} (${gesetzt} Tag(e) davor sind gespeichert.)` : grund,
      };
    }
    gesetzt += 1;
    ersterTag ??= tag;
  }

  const uebersprungen = tage.length - gesetzt;
  if (gesetzt === 0) {
    return { error: "An allen gewählten Tagen hat die Person Urlaub oder eine Abwesenheit – nichts geändert." };
  }

  if (kommentar && ersterTag) {
    await supabase.from("plan_kommentare").insert({ employee_id: employeeId, tag: ersterTag, text: kommentar });
  }

  revalidatePath("/besetzung");
  revalidatePath("/schichtplan");
  revalidatePath("/meine-schichten");

  const basis = gesetzt === 1 ? "Schichtwechsel für einen Tag gespeichert." : `Schichtwechsel für ${gesetzt} Tage gespeichert.`;
  return {
    success:
      uebersprungen > 0
        ? `${basis} ${uebersprungen} Tag(e) mit Urlaub oder Abwesenheit wurden übersprungen.`
        : basis,
  };
}

export async function removeShiftAssignment(id: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.from("shift_assignments").delete().eq("id", id);
  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Zuordnung konnte nicht entfernt werden." };
  }
  revalidatePath("/verwaltung");
  revalidatePath("/besetzung");
  revalidatePath("/schichtplan");
  revalidatePath("/meine-schichten");
  return { success: "Zuordnung entfernt." };
}

/**
 * Urlaub direkt aus dem Schichtplan setzen oder entfernen (Führung/Admin).
 * "urlaub" legt einen sofort genehmigten Urlaubstag an, der automatisch
 * vom Konto abgezogen wird; "clear" nimmt ihn zurück.
 */
export async function setLeaveForDay(
  employeeId: string,
  date: string,
  mode: LeaveKind | "clear",
): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "Supabase ist nicht konfiguriert." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_leave_for_day", {
    p_employee_id: employeeId,
    p_date: date,
    p_mode: mode,
  });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Der Urlaub konnte nicht gesetzt werden." };
  }
  return {
    success:
      mode === "clear" ? "Eintrag entfernt." : `${leaveKindLabels[mode]} eingetragen.`,
  };
}

/**
 * Reihenfolge der Mitarbeiter im Schichtplan festschreiben.
 *
 * Übergeben wird eine ganze Gruppe in der gewünschten Reihenfolge; die
 * Datenbank macht daraus die Plätze 1..n und prüft dabei selbst, ob die
 * aufrufende Person Schichtleitung oder Administration ist.
 */
export async function setEmployeeOrder(employeeIds: string[]): Promise<FormState> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase ist nicht konfiguriert." };
  }
  if (employeeIds.length === 0) return {};

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_employee_order", {
    p_employee_ids: employeeIds,
  });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Reihenfolge konnte nicht gespeichert werden." };
  }

  revalidatePath("/schichtplan");
  return { success: "Reihenfolge gespeichert." };
}
