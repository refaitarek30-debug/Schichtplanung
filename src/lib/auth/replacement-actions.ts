"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

export type { FormState };

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

/**
 * Eine Ersatzanfrage stellen.
 *
 * Die Eignung prüft die Datenbank noch einmal – das ausgegraute Kästchen
 * im Dialog sichert nichts. Kommt jemand nicht in Frage, steht der Grund
 * in der Fehlermeldung (etwa „Ruhezeit nicht ausreichend: 0.0 statt 11
 * Stunden"), statt dass die Anfrage stillschweigend scheitert.
 *
 * Wichtig: eine Anfrage plant niemanden ein. Erst `confirmReplacement()`
 * nach der Zusage setzt die Besetzung.
 */
export async function requestReplacement(
  date: string,
  shiftId: string,
  askedEmployeeId: string,
  qualificationId: string | null,
  absentEmployeeId: string | null,
  note: string,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_replacement", {
    p_date: date,
    p_shift_id: shiftId,
    p_asked_employee_id: askedEmployeeId,
    p_qualification_id: qualificationId,
    p_absent_employee_id: absentEmployeeId,
    p_note: note,
  });

  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Anfrage konnte nicht gestellt werden." };
  }

  revalidatePath("/besetzung");
  return { success: "Anfrage gesendet." };
}

/** Die eigene Anfrage beantworten. Nur die angefragte Person darf das. */
export async function answerReplacementRequest(
  requestId: string,
  annehmen: boolean,
  note = "",
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_replacement_request", {
    p_request_id: requestId,
    p_annehmen: annehmen,
    p_note: note,
  });

  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Antwort konnte nicht gespeichert werden." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/besetzung");
  return { success: annehmen ? "Zusage gespeichert." : "Absage gespeichert." };
}

/**
 * Nach der Zusage tatsächlich einplanen.
 *
 * Läuft über `plan_set_shift()` – dieselbe Funktion, die auch die
 * Schichtleitung im Plan benutzt. Sie splittet laufende Urlaubsanträge
 * und räumt Abwesenheiten weg; hier wird davon nichts nachgebaut.
 */
export async function confirmReplacement(requestId: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_replacement", { p_request_id: requestId });

  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Besetzung konnte nicht gesetzt werden." };
  }

  revalidatePath("/besetzung");
  revalidatePath("/schichtplan");
  return { success: "Besetzung gesetzt." };
}
