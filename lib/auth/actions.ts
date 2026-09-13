export async function inviteEmployee(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const employeeId = String(formData.get("employee_id") ?? "").trim();

  if (!employeeId) {
    return { error: "Mitarbeiter-ID fehlt." };
  }

  const supabase = await createClient();

  // Aktuell eingeloggten Benutzer prüfen
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !user) {
    return {
      error:
        "Deine Anmeldung konnte nicht bestätigt werden. Bitte melde dich erneut an.",
    };
  }

  // Prüfen, ob der Benutzer Administrator ist
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile error:", profileError);

    return {
      error: "Dein Benutzerprofil konnte nicht geladen werden.",
    };
  }

  if (!profile || profile.role !== "admin") {
    return {
      error: "Du hast keine Berechtigung für diesen Bereich.",
    };
  }

  // Mitarbeiter laden
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select(
      "id, email, first_name, last_name, role, company_id",
    )
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError) {
    console.error("Employee error:", employeeError);

    return {
      error: "Der Mitarbeiter konnte nicht geladen werden.",
    };
  }

  if (!employee) {
    return {
      error: "Der Mitarbeiter wurde nicht gefunden.",
    };
  }

  if (!employee.email) {
    return {
      error:
        "Für diesen Mitarbeiter ist keine E-Mail-Adresse hinterlegt.",
    };
  }

  // Sicherheitsprüfung: Mitarbeiter muss zur Firma gehören
  if (employee.company_id !== profile.company_id) {
    return {
      error: "Du hast keine Berechtigung für diesen Bereich.",
    };
  }

  try {
    const admin = createAdminClient();
    const origin = await siteOrigin();

    const { error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(employee.email, {
        redirectTo: `${origin}/auth/callback?weiter=/passwort-neu`,
        data: {
          company_id: employee.company_id,
          employee_id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          role: employee.role,
        },
      });

    if (inviteError) {
      console.error("Supabase invitation error:", inviteError);

      // Supabase lehnt die Admin-Anfrage ab
      if (inviteError.status === 401) {
        return {
          error:
            "Die Supabase-Admin-Autorisierung funktioniert nicht. Bitte SUPABASE_SERVICE_ROLE_KEY in Vercel prüfen.",
        };
      }

      // Zu viele E-Mails/Anfragen
      if (inviteError.status === 429) {
        return {
          error:
            "Zu viele Einladungen wurden verschickt. Bitte später erneut versuchen.",
        };
      }

      return {
        error:
          inviteError.message ||
          "Die Einladung konnte nicht verschickt werden.",
      };
    }
  } catch (error) {
    console.error("Invitation setup error:", error);

    return {
      error:
        "Die Einladungsfunktion konnte nicht gestartet werden. Bitte die Supabase-Konfiguration prüfen.",
    };
  }

  revalidatePath("/mitarbeiter");

  return {
    success: `Einladung an ${employee.email} verschickt.`,
  };
}
