"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

export type { FormState };
import type { LeaveRequestRow } from "@/lib/supabase/database.types";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Im produktiven Betrieb ist der Backend-Zugriff erforderlich.",
};

/**
 * Legt einen Urlaubsantrag an. `requested_days` wird zwar mitgeschickt
 * (nur für die Anzeige direkt nach dem Absenden), die Datenbank berechnet
 * den Wert über den Trigger `leave_requests_compute_days` serverseitig neu
 * und verwirft, was der Client geschickt hat.
 */
export async function submitLeaveRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const halfDayPeriod = String(formData.get("half_day_period") ?? "") || null;
  const reason = String(formData.get("reason") ?? "").trim();
  // Zwei getrennte Konten: "urlaub" und "v_tag". Unbekannte Werte fallen
  // bewusst auf Urlaub zurück, statt den Antrag scheitern zu lassen.
  const kindRaw = String(formData.get("kind") ?? "urlaub");
  // "auto" überlässt der Datenbank die Verteilung auf beide Konten.
  if (kindRaw === "auto") return submitLeaveAuto(_prev, formData);
  const kind = kindRaw === "v_tag" ? "v_tag" : "urlaub";

  if (!startDate || !endDate) {
    return { error: "Bitte Start- und Enddatum auswählen." };
  }
  if (endDate < startDate) {
    return { error: "Das Enddatum darf nicht vor dem Startdatum liegen." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("employee_id, company_id")
    .eq("id", user.id)
    .returns<{ employee_id: string | null; company_id: string }[]>()
    .maybeSingle();

  if (profileError || !profile?.employee_id) {
    return {
      error:
        "Dein Konto ist noch keinem Personalstammsatz zugeordnet. Bitte an die Administration wenden.",
    };
  }

  const { error } = await supabase.from("leave_requests").insert({
    company_id: profile.company_id,
    employee_id: profile.employee_id,
    start_date: startDate,
    end_date: endDate,
    half_day_period: halfDayPeriod,
    kind,
    // Platzhalter – der Trigger überschreibt diesen Wert serverseitig.
    requested_days: 0,
    reason: reason || null,
  });

  if (error) {
    // Trigger-Exceptions (ungültiger Zeitraum, kein Arbeitstag) kommen
    // als Postgres-Fehler ohne RLS-Code hier an.
    if (error.message?.includes("Enddatum")) return { error: error.message };
    if (error.message?.includes("Arbeitstag")) return { error: error.message };
    return { error: dataErrorMessage(error) ?? "Der Antrag konnte nicht gespeichert werden." };
  }

  revalidatePath("/urlaub");
  revalidatePath("/dashboard");
  revalidatePath("/urlaubsantraege");
  return {
    success:
      kind === "v_tag"
        ? "V-Tag beantragt – Status: Ausstehend."
        : "Antrag eingereicht – Status: Ausstehend.",
  };
}

export async function withdrawMyLeaveRequest(requestId: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const supabase = await createClient();
  const { error } = await supabase
    .rpc("withdraw_leave_request", { p_request_id: requestId })
    .returns<LeaveRequestRow>();

  if (error) {
    return {
      error: error.message?.includes("nicht mehr zurückziehen")
        ? "Dieser Antrag lässt sich nicht mehr zurückziehen."
        : dataErrorMessage(error) ?? "Zurückziehen fehlgeschlagen.",
    };
  }

  revalidatePath("/urlaub");
  revalidatePath("/dashboard");
  revalidatePath("/urlaubsantraege");
  return { success: "Antrag zurückgezogen." };
}

export async function decideLeaveRequestAction(
  requestId: string,
  decision: "approved" | "rejected",
  rejectionReason?: string,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  if (decision === "rejected" && !rejectionReason?.trim()) {
    return { error: "Für eine Ablehnung ist eine Begründung erforderlich." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .rpc("decide_leave_request", {
      p_request_id: requestId,
      p_decision: decision,
      p_rejection_reason: decision === "rejected" ? rejectionReason!.trim() : null,
    })
    .returns<LeaveRequestRow>();

  if (error) {
    const message = error.message ?? "";
    if (message.includes("bereits entschieden")) {
      return { error: "Dieser Antrag wurde inzwischen bereits entschieden." };
    }
    if (message.includes("nicht genügend Urlaubstage")) {
      return { error: "Für diesen Antrag stehen nicht genügend Urlaubstage zur Verfügung." };
    }
    if (message.includes("keine Berechtigung")) {
      return { error: "Du hast keine Berechtigung für diesen Bereich." };
    }
    return {
      error: dataErrorMessage(error) ?? "Die Entscheidung konnte nicht gespeichert werden.",
    };
  }

  revalidatePath("/urlaubsantraege");
  revalidatePath("/urlaub");
  revalidatePath("/dashboard");
  return {
    success:
      decision === "approved" ? "Urlaubsantrag genehmigt." : "Urlaubsantrag abgelehnt.",
  };
}

/**
 * Zeitraum einreichen und die Verteilung der Datenbank überlassen.
 *
 * Sie geht den Zeitraum Tag für Tag durch: Sonntag, Feiertag und
 * Nachtschicht kosten einen Urlaubstag (dann wird der Zuschlag mitbezahlt),
 * alle anderen Arbeitstage einen V-Tag. Freie Tage kosten nichts. Ist ein
 * Konto leer, wird auf das andere ausgewichen. Für jeden zusammenhängenden
 * Block gleicher Art entsteht ein eigener Antrag.
 */
export async function submitLeaveAuto(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!startDate || !endDate) return { error: "Bitte Start- und Enddatum auswählen." };
  if (endDate < startDate) {
    return { error: "Das Enddatum darf nicht vor dem Startdatum liegen." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_leave_auto", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_reason: reason || null,
  });

  if (error) {
    return { error: dataErrorMessage(error) ?? "Der Antrag konnte nicht gespeichert werden." };
  }

  const result = ((data ?? []) as { urlaub_tage: number; v_tage: number; antraege: number }[])[0];
  revalidatePath("/urlaub");
  revalidatePath("/dashboard");
  revalidatePath("/urlaubsantraege");

  if (!result) return { success: "Antrag eingereicht – Status: Ausstehend." };

  const teile = [
    result.urlaub_tage > 0 ? `${result.urlaub_tage} Urlaubstag(e)` : null,
    result.v_tage > 0 ? `${result.v_tage} V-Tag(e)` : null,
  ].filter(Boolean);

  return {
    success: `Eingereicht: ${teile.join(" und ")} in ${result.antraege} Antrag/Anträgen – Status: Ausstehend.`,
  };
}
