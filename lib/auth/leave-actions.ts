"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./actions";

export type { FormState };
import type { LeaveRequestRow } from "@/lib/supabase/database.types";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
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
  return { success: "Antrag eingereicht – Status: Ausstehend." };
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
