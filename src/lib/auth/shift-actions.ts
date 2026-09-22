"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";
import type { ProfileRow } from "@/lib/supabase/database.types";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

interface ShiftInput {
  name: string;
  shortName: string;
  startTime: string;
  endTime: string;
  color: string;
  minimumStaff: number;
  targetStaff: number;
  weekdays: number[];
}

function readShiftInput(formData: FormData): ShiftInput | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const shortName = String(formData.get("short_name") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();
  const color = String(formData.get("color") ?? "#2F5BEA").trim();
  const minimumStaff = Number.parseInt(String(formData.get("minimum_staff") ?? "0"), 10);
  const targetStaff = Number.parseInt(String(formData.get("target_staff") ?? "0"), 10);
  const weekdays = formData.getAll("weekdays").map((v) => Number.parseInt(String(v), 10));

  if (!name || !shortName) {
    return { error: "Name und Kurzname dürfen nicht leer sein." };
  }
  if (!startTime || !endTime) {
    return { error: "Bitte Beginn und Ende der Schicht angeben." };
  }
  if (!Number.isFinite(minimumStaff) || minimumStaff < 0) {
    return { error: "Die Mindestbesetzung muss eine Zahl ab 0 sein." };
  }
  if (!Number.isFinite(targetStaff) || targetStaff < 0) {
    return { error: "Die Soll-Besetzung muss eine Zahl ab 0 sein." };
  }
  if (targetStaff < minimumStaff) {
    return { error: "Die Soll-Besetzung darf nicht unter der Mindestbesetzung liegen." };
  }
  if (weekdays.length === 0) {
    return { error: "Bitte mindestens einen Wochentag auswählen." };
  }

  return { name, shortName, startTime, endTime, color, minimumStaff, targetStaff, weekdays };
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .returns<Pick<ProfileRow, "role" | "company_id">[]>()
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return { error: "Du hast keine Berechtigung für diesen Bereich." } as const;
  }
  return { supabase, companyId: profile.company_id } as const;
}

/** Legt eine neue Schicht an. Die Policy "Schichten verwaltet Admin" (ALL) erzwingt es ohnehin. */
export async function createShift(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const input = readShiftInput(formData);
  if ("error" in input) return { error: input.error };

  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase.from("shifts").insert({
    company_id: auth.companyId,
    name: input.name,
    short_name: input.shortName,
    start_time: input.startTime,
    end_time: input.endTime,
    color: input.color || null,
    minimum_staff: input.minimumStaff,
    target_staff: input.targetStaff,
    weekdays: input.weekdays,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Eine Schicht mit diesem Kurznamen existiert in deinem Unternehmen bereits." };
    }
    return { error: dataErrorMessage(error) ?? "Die Schicht konnte nicht angelegt werden." };
  }

  revalidatePath("/verwaltung");
  revalidatePath("/besetzung");
  revalidatePath("/schichtplan");
  return { success: `${input.name} wurde angelegt.` };
}

/** Bearbeitet eine bestehende Schicht, inklusive Aktiv-/Inaktiv-Status. */
export async function updateShift(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Schicht fehlt." };

  const input = readShiftInput(formData);
  if ("error" in input) return { error: input.error };
  const active = formData.get("active") === "on";

  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("shifts")
    .update({
      name: input.name,
      short_name: input.shortName,
      start_time: input.startTime,
      end_time: input.endTime,
      color: input.color || null,
      minimum_staff: input.minimumStaff,
      target_staff: input.targetStaff,
      weekdays: input.weekdays,
      active,
    })
    .eq("id", id)
    .eq("company_id", auth.companyId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Eine Schicht mit diesem Kurznamen existiert in deinem Unternehmen bereits." };
    }
    return { error: dataErrorMessage(error) ?? "Die Änderungen konnten nicht gespeichert werden." };
  }

  revalidatePath("/verwaltung");
  revalidatePath("/besetzung");
  revalidatePath("/schichtplan");
  return { success: `${input.name} wurde gespeichert.` };
}

/**
 * Soll- und Mindestbesetzung einer Schicht setzen.
 *
 * Bewusst über `set_shift_staffing()` statt über einen direkten Schreibzugriff
 * auf `shifts`: die Tabellenrichtlinie dort bleibt bei „nur Admin", diese
 * Funktion fasst genau ein Feldpaar an, prüft `is_leadership()` und
 * protokolliert die Änderung. Besetzungsvorgaben steuern jede
 * Urlaubsentscheidung – wer sie ändert, soll nachvollziehbar sein.
 */
export async function saveShiftStaffing(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const shiftId = String(formData.get("shift_id") ?? "");
  const target = Number.parseInt(String(formData.get("target_staff") ?? ""), 10);
  const minimum = Number.parseInt(String(formData.get("minimum_staff") ?? ""), 10);

  if (!shiftId) return { error: "Schicht fehlt." };
  if (!Number.isFinite(target) || target < 0) {
    return { error: "Die Sollbesetzung muss eine Zahl ab 0 sein." };
  }
  if (!Number.isFinite(minimum) || minimum < 0) {
    return { error: "Die Mindestbesetzung muss eine Zahl ab 0 sein." };
  }
  if (minimum > target) {
    return { error: "Die Mindestbesetzung darf nicht über der Sollbesetzung liegen." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_shift_staffing", {
    p_shift_id: shiftId,
    p_target: target,
    p_minimum: minimum,
  });

  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Besetzungsvorgaben konnten nicht gespeichert werden." };
  }

  revalidatePath("/verwaltung");
  revalidatePath("/besetzung");
  revalidatePath("/schichtplan");
  revalidatePath("/urlaub");
  revalidatePath("/urlaubsantraege");
  return { success: "Besetzungsvorgaben gespeichert." };
}
