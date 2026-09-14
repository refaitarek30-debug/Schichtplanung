"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";
import type { PatternBlock } from "./rotation-pattern-actions";

export type { FormState };

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

/**
 * Einrichtung als abgeschlossen markieren – oder wieder öffnen, wenn
 * jemand sie später noch einmal durchgehen will. Beides prüft die
 * Datenbank gegen `is_admin()`, nicht das ausgegraute Formular.
 */
export async function completeSetup(abgeschlossen = true): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_setup", {
    p_abgeschlossen: abgeschlossen,
  });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Einrichtung konnte nicht gespeichert werden." };
  }

  revalidatePath("/einrichtung");
  revalidatePath("/dashboard");
  revalidatePath("/einstellungen");
  return {
    success: abgeschlossen
      ? "Einrichtung abgeschlossen."
      : "Einrichtung wieder geöffnet.",
  };
}

/**
 * Schichtsystem festlegen: Muster speichern und allen Mitarbeitern mit
 * Schichtgruppe zuordnen. Anders als `saveRotationPattern()` nimmt diese
 * Fassung die Anzahl der Rotationsgruppen entgegen – daraus ergibt sich
 * der Versatz zwischen den Gruppen. Bisher waren stillschweigend immer
 * vier angenommen.
 */
export async function saveShiftSystem(
  blocks: PatternBlock[],
  anchorDate: string,
  teams: number,
  name = "Schichtmuster",
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  if (blocks.length === 0) return { error: "Bitte mindestens einen Block anlegen." };
  if (blocks.some((b) => b.days < 1)) return { error: "Jeder Block braucht mindestens einen Tag." };
  if (teams < 1 || teams > 4) return { error: "Es sind ein bis vier Rotationsgruppen möglich." };

  const supabase = await createClient();

  const { error: saveError } = await supabase.rpc("save_rotation_pattern", {
    p_name: name,
    p_anchor_date: anchorDate,
    p_blocks: blocks,
    p_teams: teams,
  });
  if (saveError) {
    return { error: dataErrorMessage(saveError) ?? "Das Muster konnte nicht gespeichert werden." };
  }

  // Zuordnen darf scheitern, ohne dass das Muster verloren ist – etwa
  // wenn noch niemand einer Gruppe zugeordnet ist. Das ist kein Fehler,
  // sondern der Normalfall bei einer frisch angelegten Firma.
  const { error: applyError } = await supabase.rpc("apply_rotation_to_all");
  if (applyError) {
    return {
      success:
        "Schichtmuster gespeichert. Zugeordnet wird es, sobald Mitarbeiter eine Schichtgruppe haben.",
    };
  }

  revalidatePath("/schichten");
  revalidatePath("/schichtplan");
  revalidatePath("/einrichtung");
  return { success: "Schichtmuster gespeichert und allen Schichtgruppen zugeordnet." };
}
