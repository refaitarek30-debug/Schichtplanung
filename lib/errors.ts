/** Übersetzt technische Fehler in Sätze, die einem Benutzer weiterhelfen. */
export function authErrorMessage(error: { message?: string; status?: number } | null) {
  if (!error) return null;
  const message = (error.message ?? "").toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "E-Mail oder Passwort ist falsch.";
  }
  if (message.includes("email not confirmed")) {
    return "Dieses Konto ist noch nicht bestätigt. Bitte den Einladungslink aus der E-Mail öffnen.";
  }
  if (message.includes("user not found")) {
    return "Zu dieser E-Mail-Adresse gibt es kein Konto.";
  }
  if (message.includes("password should be at least")) {
    return "Das Passwort muss mindestens 8 Zeichen lang sein.";
  }
  if (message.includes("new password should be different")) {
    return "Das neue Passwort muss sich vom bisherigen unterscheiden.";
  }
  if (message.includes("token has expired") || message.includes("invalid token")) {
    return "Der Link ist abgelaufen. Bitte einen neuen Link anfordern.";
  }
  if (message.includes("over_email_send_rate_limit") || error.status === 429) {
    return "Zu viele Versuche. Bitte in ein paar Minuten erneut probieren.";
  }
  if (message.includes("jwt") || error.status === 401) {
    return "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.";
  }
  return "Das hat nicht geklappt. Bitte später erneut versuchen.";
}

/** Fehler bei Datenzugriffen – inklusive abgewiesener RLS-Zugriffe. */
export function dataErrorMessage(error: { message?: string; code?: string } | null) {
  if (!error) return null;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (code === "42501" || message.includes("row-level security")) {
    return "Du hast keine Berechtigung für diesen Bereich.";
  }
  if (code === "PGRST301" || message.includes("jwt expired")) {
    return "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.";
  }
  if (code === "23505") {
    return "Dieser Eintrag existiert bereits.";
  }
  return "Die Daten konnten nicht geladen werden.";
}
