"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./actions";

export interface PatternBlock {
  code: "F" | "S" | "N" | "FREI";
  days: number;
}

/**
 * Speichert das Schichtmuster des Unternehmens (nur Admin, per RPC serverseitig
 * geprüft) und ordnet es anschließend allen Mitarbeitern mit Schichtgruppe zu.
 * Der Admin gibt EINEN Zyklus ein (z. B. F F S S N N N frei frei); das System
 * setzt ihn fort und verteilt die Gruppen A–D versetzt.
 */
export async function saveRotationPattern(
  blocks: PatternBlock[],
  anchorDate: string,
  name: string,
): Promise<FormState> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase ist nicht konfiguriert." };
  }
  if (blocks.length === 0) {
    return { error: "Bitte mindestens einen Block anlegen." };
  }
  if (blocks.some((b) => b.days < 1)) {
    return { error: "Jeder Block braucht mindestens einen Tag." };
  }

  const supabase = await createClient();

  const { error: saveError } = await supabase.rpc("save_rotation_pattern", {
    p_name: name || "Schichtmuster",
    p_anchor_date: anchorDate,
    p_blocks: blocks,
  });
  if (saveError) {
    return { error: dataErrorMessage(saveError) ?? "Das Muster konnte nicht gespeichert werden." };
  }

  const { error: applyError } = await supabase.rpc("apply_rotation_to_all");
  if (applyError) {
    return {
      error:
        "Das Muster wurde gespeichert, konnte aber nicht allen Mitarbeitern zugeordnet werden: " +
        (dataErrorMessage(applyError) ?? ""),
    };
  }

  revalidatePath("/schichten");
  revalidatePath("/schichtplan");
  return { success: "Schichtmuster gespeichert und allen Schichtgruppen zugeordnet." };
}
