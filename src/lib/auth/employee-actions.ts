"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";
import { grantAccess, siteOrigin } from "./invite";
import type { Role } from "@/lib/types";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Im produktiven Betrieb ist der Backend-Zugriff erforderlich.",
};

/**
 * Die angehakten Qualifikationen als Schlüssel.
 *
 * Geprüft wird nicht mehr hier: seit Migration 0050 führt jedes
 * Unternehmen seinen eigenen Katalog, und welche Schlüssel es darin gibt,
 * weiß nur die Datenbank. `set_employee_qualifications()` verwirft
 * unbekannte still – dieselbe Wirkung wie die frühere Liste, aber an der
 * Stelle, die den Katalog tatsächlich kennt.
 */
function parseQualifications(formData: FormData): string[] {
  return formData.getAll("qualifications").map((v) => String(v).trim()).filter(Boolean);
}

/**
 * Ein Datumsfeld aus dem Formular. Leer bleibt leer – das bedeutet in der
 * Datenbank „keine Grenze" und darf nicht in einen Wert umschlagen.
 */
function parseDate(formData: FormData, name: string): string | null {
  const wert = String(formData.get(name) ?? "").trim();
  return wert === "" ? null : wert;
}

/**
 * Austritt darf nicht vor dem Eintritt liegen. Die Datenbank hat dafür
 * eine Prüfbedingung, die aber nur eine rohe Meldung liefert – hier steht
 * ein Satz, mit dem jemand etwas anfangen kann.
 */
function pruefeZeitraum(formData: FormData): string | null {
  const eintritt = parseDate(formData, "entry_date");
  const austritt = parseDate(formData, "exit_date");
  if (eintritt && austritt && austritt < eintritt) {
    return "Der Austritt darf nicht vor dem Eintritt liegen.";
  }
  return null;
}


/**
 * Findet das aktive Rotationsmuster des Unternehmens. Eine Schichtgruppe
 * (A–D) ohne verknüpftes Muster bewirkt nichts – der Versatz bleibt dann 0
 * und die Rotation greift nicht (das war der eigentliche Fehler, den diese
 * Funktion behebt: das Formular setzte bisher nur `rotation_team`, nie
 * `rotation_pattern_id`). Geht davon aus, dass ein Unternehmen ein aktives
 * Muster pflegt; bei mehreren wird das zuerst angelegte verwendet.
 */
async function findActiveRotationPatternId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("rotation_patterns")
    .select("id")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .returns<{ id: string }[]>();
  return data?.[0]?.id ?? null;
}

/**
 * Legt einen Personalstammsatz an – noch ohne Login. Die Einladung
 * verschickt `inviteEmployee()` in einem zweiten Schritt, sobald der Datensatz
 * existiert (entspricht dem in Phase 2 vorgesehenen Ablauf: Administrator
 * legt an → Mitarbeiter erhält Einladung → setzt Passwort).
 */
export async function createEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const personnelNumber = String(formData.get("personnel_number") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const shiftId = String(formData.get("shift_id") ?? "").trim();
  const role = String(formData.get("role") ?? "employee") as Role;
  // Vorgabe 0, nicht 30/27: eine Zahl, die niemand eingegeben hat, soll
  // nicht wie ein gepflegter Wert aussehen. Dieselbe Vorgabe steht in der
  // Datenbank an den Spalten selbst.
  const vacationDaysRaw = String(formData.get("vacation_days") ?? "0");
  const vacationDays = Number.parseFloat(vacationDaysRaw.replace(",", "."));
  const vDaysRaw = String(formData.get("v_days") ?? "0");
  const vDays = Number.parseFloat(vDaysRaw.replace(",", "."));

  if (!firstName || !lastName) {
    return { error: "Vor- und Nachname dürfen nicht leer sein." };
  }
  if (!Number.isFinite(vacationDays) || vacationDays < 0) {
    return { error: "Der Urlaubsanspruch muss eine Zahl ab 0 sein." };
  }
  const zeitraumFehler = pruefeZeitraum(formData);
  if (zeitraumFehler) return { error: zeitraumFehler };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .returns<{ role: Role; company_id: string }[]>()
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "Dein Profil konnte nicht geladen werden." };
  }
  if (profile.role !== "admin") {
    return { error: "Du hast keine Berechtigung für diesen Bereich." };
  }

  const rotationTeam = String(formData.get("rotation_team") ?? "").trim();
  const rotationPatternId = rotationTeam
    ? await findActiveRotationPatternId(supabase, profile.company_id)
    : null;

  const { data: inserted, error } = await supabase
    .from("employees")
    .insert({
      company_id: profile.company_id,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      personnel_number: personnelNumber || null,
      department: department || null,
      shift_id: shiftId || null,
      role,
      vacation_days: vacationDays,
      v_days: Number.isFinite(vDays) ? vDays : 0,
      rotation_team: rotationTeam || null,
      rotation_pattern_id: rotationPatternId,
      entry_date: parseDate(formData, "entry_date"),
      exit_date: parseDate(formData, "exit_date"),
      is_apprentice: formData.get("is_apprentice") === "on",
      // Steuert, ob Urlaub automatisch auf Urlaubstage und V-Tage verteilt
      // wird. Ohne Schichtsystem gibt es keine Zuschläge und damit nichts
      // zu optimieren – dann kostet jeder Tag einen Urlaubstag.
      shift_worker: formData.get("shift_worker") === "on",
    })
    .select("id")
    .returns<{ id: string }[]>();

  if (error) {
    if (error.code === "23505") {
      return { error: "Diese Personalnummer ist in deinem Unternehmen bereits vergeben." };
    }
    return { error: dataErrorMessage(error) ?? "Der Mitarbeiter konnte nicht angelegt werden." };
  }

  // Resturlaub aus dem Vorjahr (die "V"-Tage aus dem gewohnten Plan) direkt
  // ins Urlaubskonto übernehmen, falls angegeben. Der Trigger legt beim
  // Anlegen bereits eine Kontozeile für das laufende Jahr an – die
  // ergänzen wir hier um den Übertrag.
  const carryOverRaw = String(formData.get("carry_over") ?? "").trim();
  const carryOver = carryOverRaw ? Number.parseFloat(carryOverRaw.replace(",", ".")) : 0;
  const newId = inserted?.[0]?.id;
  if (newId && Number.isFinite(carryOver) && carryOver > 0) {
    await supabase
      .from("leave_balances")
      .update({ carried_over: carryOver })
      .eq("employee_id", newId)
      .eq("year", new Date().getFullYear());
  }

  // Qualifikationen stehen seit Migration 0050 in eigenen Tabellen. Die
  // Funktion prüft Berechtigung und Katalog und verwirft unbekannte
  // Schlüssel – deshalb hier kein eigener Abgleich.
  if (newId) {
    const { error: qualError } = await supabase.rpc("set_employee_qualifications", {
      p_employee_id: newId,
      p_keys: parseQualifications(formData),
    });
    // Der Stammsatz steht bereits; eine gescheiterte Zuordnung soll das
    // Anlegen nicht zurücknehmen, sondern sichtbar werden.
    if (qualError) {
      console.error("Qualifikationen konnten nicht gesetzt werden:", qualError.message);
    }
  }

  revalidatePath("/verwaltung");

  // Mit E-Mail-Adresse gleich den Zugang einrichten. Vorher war das ein
  // zweiter, leicht zu übersehender Schritt – man legte jemanden an, wartete
  // auf eine Mail und es kam nie eine, weil niemand auf "Einladen" geklickt
  // hatte.
  if (email && newId) {
    const zugang = await grantAccess(
      {
        id: newId,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        company_id: profile.company_id,
      },
      await siteOrigin(),
    );

    if (zugang.error) {
      return {
        success: `${firstName} ${lastName} wurde angelegt.`,
        error: `Der Zugang konnte noch nicht eingerichtet werden: ${zugang.error}`,
      };
    }
    return {
      success: `${firstName} ${lastName} wurde angelegt. ${zugang.success ?? ""}`.trim(),
      link: zugang.link,
    };
  }

  return {
    success: `${firstName} ${lastName} wurde angelegt. Ohne E-Mail-Adresse gibt es keinen Zugang – die Adresse lässt sich jederzeit nachtragen.`,
  };
}

/**
 * Ändert einen bestehenden Personalstammsatz. Spiegelt `createEmployee()`
 * bewusst 1:1 in Feldern und Prüfungen – nur `.update()` statt `.insert()`,
 * zusätzlich `employee_id` zum Identifizieren der Zeile. RLS
 * ("Personaldaten verwaltet Admin") erzwingt Admin-only zusätzlich
 * serverseitig, unabhängig von der Rollenprüfung hier.
 */
export async function updateEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const personnelNumber = String(formData.get("personnel_number") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const shiftId = String(formData.get("shift_id") ?? "").trim();
  const role = String(formData.get("role") ?? "employee") as Role;
  const vacationDaysRaw = String(formData.get("vacation_days") ?? "0");
  const vacationDays = Number.parseFloat(vacationDaysRaw.replace(",", "."));
  const vDaysRaw = String(formData.get("v_days") ?? "0");
  const vDays = Number.parseFloat(vDaysRaw.replace(",", "."));
  const active = formData.get("active") !== "false";

  if (!employeeId) {
    return { error: "Kein Mitarbeiter ausgewählt." };
  }
  if (!firstName || !lastName) {
    return { error: "Vor- und Nachname dürfen nicht leer sein." };
  }
  if (!Number.isFinite(vacationDays) || vacationDays < 0) {
    return { error: "Der Urlaubsanspruch muss eine Zahl ab 0 sein." };
  }
  if (!Number.isFinite(vDays) || vDays < 0) {
    return { error: "Die V-Tage müssen eine Zahl ab 0 sein." };
  }
  const zeitraumFehler = pruefeZeitraum(formData);
  if (zeitraumFehler) return { error: zeitraumFehler };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .returns<{ role: Role; company_id: string }[]>()
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "Dein Profil konnte nicht geladen werden." };
  }
  // Bearbeiten dürfen Schichtleitung und Administration – anders als das
  // Anlegen, das der Administration vorbehalten bleibt.
  if (profile.role !== "admin" && profile.role !== "shift_leader") {
    return { error: "Du hast keine Berechtigung für diesen Bereich." };
  }

  const rotationTeam = String(formData.get("rotation_team") ?? "").trim();
  const rotationPatternId = rotationTeam
    ? await findActiveRotationPatternId(supabase, profile.company_id)
    : null;

  // Die bisherige Adresse VOR dem Schreiben lesen – nur so lässt sich
  // erkennen, ob sie sich geändert hat. Danach steht dort schon die neue.
  const { data: vorher } = await supabase
    .from("employees")
    .select("email")
    .eq("id", employeeId)
    .eq("company_id", profile.company_id)
    .returns<{ email: string | null }[]>()
    .maybeSingle();

  const { error } = await supabase
    .from("employees")
    .update({
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      personnel_number: personnelNumber || null,
      department: department || null,
      shift_id: shiftId || null,
      role,
      vacation_days: vacationDays,
      // Früher stand hier `... || 27`. In JavaScript ist 0 falsy, also wurde
      // aus „keine V-Tage" stillschweigend wieder der Regelanspruch von 27 –
      // das Feld ließ sich nicht auf null setzen. Geprüft wird jetzt oben,
      // hier steht nur noch der geprüfte Wert.
      v_days: vDays,
      shift_worker: formData.get("shift_worker") === "on",
      active,
      rotation_team: rotationTeam || null,
      rotation_pattern_id: rotationPatternId,
      entry_date: parseDate(formData, "entry_date"),
      exit_date: parseDate(formData, "exit_date"),
      is_apprentice: formData.get("is_apprentice") === "on",
    })
    .eq("id", employeeId)
    .eq("company_id", profile.company_id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Diese Personalnummer ist in deinem Unternehmen bereits vergeben." };
    }
    return { error: dataErrorMessage(error) ?? "Der Mitarbeiter konnte nicht geändert werden." };
  }

  const { error: qualError } = await supabase.rpc("set_employee_qualifications", {
    p_employee_id: employeeId,
    p_keys: parseQualifications(formData),
  });
  if (qualError) {
    return {
      error:
        dataErrorMessage(qualError) ?? "Die Qualifikationen konnten nicht gespeichert werden.",
    };
  }

  revalidatePath("/verwaltung");

  // Neue oder geänderte Adresse: gleich einen frischen Zugangslink erzeugen.
  //
  // Ohne das stand die Administration nach einer Adressänderung mit leeren
  // Händen da – die Person konnte sich unter der neuen Adresse nicht
  // anmelden, und es gab keinen Weg, ihr einen zu geben, ausser den
  // Mitarbeiter erneut zu "einladen". Da die App ohnehin keine Mail mehr
  // verschickt, ist der Link hier der einzige Weg und gehört direkt ins
  // Ergebnis.
  const adresseGeaendert =
    email.length > 0 && email.toLowerCase() !== (vorher?.email ?? "").toLowerCase();

  if (adresseGeaendert) {
    const zugang = await grantAccess(
      {
        id: employeeId,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        company_id: profile.company_id,
      },
      await siteOrigin(),
    );

    if (zugang.error) {
      return {
        success: `${firstName} ${lastName} wurde aktualisiert.`,
        error: `Ein Zugangslink für die neue Adresse liess sich nicht erzeugen: ${zugang.error}`,
      };
    }
    return {
      success: `${firstName} ${lastName} wurde aktualisiert. ${zugang.success ?? ""}`.trim(),
      link: zugang.link,
    };
  }

  return { success: `${firstName} ${lastName} wurde aktualisiert.` };
}

/**
 * Löscht einen Personalstammsatz endgültig – anders als das bloße
 * Deaktivieren (bleibt für den normalen Alltag die richtige Wahl, siehe
 * `setEmployeeActive()` in `data/employees.ts`). Nur Admin.
 *
 * Sicherheitsbremse: hat die Person bereits einen Login (eine Zeile in
 * `profiles`), wird das Löschen verweigert. Grund: `profiles.employee_id`
 * verweist per `ON DELETE SET NULL` auf diese Zeile – ein Hard-Delete
 * würde den Zugang als „Karteileiche" ohne Personalstammsatz zurücklassen,
 * statt sauber aufzuräumen. Erst deaktivieren bzw. den Zugang entfernen,
 * dann löschen.
 */
export async function deleteEmployee(employeeId: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  if (!employeeId) return { error: "Kein Mitarbeiter ausgewählt." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .returns<{ role: Role; company_id: string }[]>()
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return { error: "Du hast keine Berechtigung für diesen Bereich." };
  }

  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId);

  if ((count ?? 0) > 0) {
    return {
      error:
        "Diese Person hat noch einen Zugang. Bitte zuerst deaktivieren – ein Löschen würde den Zugang ohne Personalstammsatz zurücklassen.",
    };
  }

  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", employeeId)
    .eq("company_id", profile.company_id);

  if (error) {
    return { error: dataErrorMessage(error) ?? "Der Mitarbeiter konnte nicht gelöscht werden." };
  }

  revalidatePath("/verwaltung");
  return { success: "Mitarbeiter gelöscht." };
}
