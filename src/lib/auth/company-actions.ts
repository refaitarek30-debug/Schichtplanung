"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authErrorMessage, dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

export type { FormState };

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

async function siteOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${protocol}://${host}`;
}

/**
 * Legt ein neues Unternehmen samt erstem Administrator an – der
 * Selbstbedienungs-Weg, mit dem weitere Firmen dieselbe Anwendung nutzen
 * können, ohne dass jemand manuell in der Datenbank etwas anlegen muss.
 *
 * Ablauf: `register_company()` (Postgres-Funktion, für `anon` freigegeben –
 * der einzige bewusst öffentliche Einstiegspunkt im ganzen Schema) legt
 * `companies` + `employees` an. Danach übernimmt `supabase.auth.signUp()`
 * mit den beiden IDs in den User-Metadaten; der bereits vorhandene Trigger
 * `handle_new_user()` legt daraus automatisch das `profiles`-Profil an –
 * exakt derselbe Mechanismus wie beim Einladen einzelner Mitarbeiter.
 */
export async function registerCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const companyName = String(formData.get("company_name") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordRepeat = String(formData.get("password_repeat") ?? "");
  const avvAccepted = formData.get("avv_accepted") === "on";

  if (!companyName) return { error: "Bitte einen Unternehmensnamen angeben." };
  if (!firstName || !lastName) return { error: "Bitte Vor- und Nachnamen angeben." };
  if (!email) return { error: "Bitte eine E-Mail-Adresse angeben." };
  if (password.length < 8) return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  if (password !== passwordRepeat) return { error: "Die beiden Passwörter stimmen nicht überein." };
  // Pflichtangabe. Der Zeitstempel entsteht in register_company(), nicht
  // hier – was der Browser schickt, ist kein Nachweis.
  if (!avvAccepted) {
    return {
      error:
        "Bitte bestätige, dass du die Datenschutzerklärung gelesen und den Auftragsverarbeitungsvertrag akzeptiert hast.",
    };
  }

  const supabase = await createClient();

  const { data, error: rpcError } = await supabase.rpc("register_company", {
    p_company_name: companyName,
    p_first_name: firstName,
    p_last_name: lastName,
    p_email: email,
    p_avv_accepted: avvAccepted,
  });

  const registered = (data ?? []) as { company_id: string; employee_id: string }[];

  if (rpcError || !registered[0]) {
    return { error: dataErrorMessage(rpcError) ?? "Das Unternehmen konnte nicht angelegt werden." };
  }

  const { company_id, employee_id } = registered[0];
  const origin = await siteOrigin();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        company_id,
        employee_id,
        first_name: firstName,
        last_name: lastName,
        role: "admin",
      },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (signUpError) {
    // Das Unternehmen steht schon, der Zugang dazu nicht. Ohne Aufräumen
    // bliebe eine vollständig eingerichtete Firma zurück, auf die sich
    // niemand anmelden kann und die niemand mehr loswird. Die Funktion
    // greift nur bei einem Unternehmen ohne jedes Profil – ein echtes
    // kann sie nicht anrühren.
    const { error: cleanupError } = await supabase.rpc("discard_unclaimed_company", {
      p_company_id: company_id,
    });
    if (cleanupError) {
      console.error(
        "Registrierung fehlgeschlagen und das angelegte Unternehmen konnte nicht " +
          `zurückgenommen werden (company_id ${company_id}):`,
        cleanupError.message,
      );
    }
    return { error: authErrorMessage(signUpError) ?? "Die Registrierung ist fehlgeschlagen." };
  }

  // Ist die Bestätigungsmail in Supabase deaktiviert, kommt sofort eine
  // Session zurück – dann direkt in den Einrichtungsassistenten. Sonst
  // muss die E-Mail erst bestätigt werden, bevor eine Session entsteht;
  // der Hinweis auf dem Dashboard führt dann später dorthin.
  if (signUpData.session) {
    redirect("/einrichtung");
  }

  return {
    success:
      "Unternehmen angelegt. Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben – danach kannst du dich anmelden.",
  };
}
