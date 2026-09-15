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
  // Supabase antwortet mit 500 "Error sending confirmation email", wenn die
  // Bestätigungsmail nicht zugestellt werden kann. Das Konto wird dann gar
  // nicht erst angelegt – die Registrierung ist also nicht "später noch mal
  // versuchen", sondern blockiert, bis jemand den Mailversand einrichtet.
  if (message.includes("error sending") || message.includes("confirmation email")) {
    return (
      "Die Registrierung konnte nicht abgeschlossen werden, weil die " +
      "Bestätigungsmail nicht versendet werden konnte. Das liegt an der " +
      "Mail-Einstellung des Anbieters, nicht an deinen Angaben. Bitte wende " +
      "dich an den Betreiber dieser Anwendung."
    );
  }
  if (message.includes("already registered") || message.includes("already been registered")) {
    return (
      "Zu dieser E-Mail-Adresse gibt es bereits ein Konto. Jede Adresse kann " +
      "nur zu einem Unternehmen gehören – bitte melde dich an oder nimm eine " +
      "andere Adresse."
    );
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
  // P0001 = "raise exception" in einer Postgres-Funktion. Jede dieser
  // Meldungen im Schema ist bewusst als vollständiger, verständlicher Satz
  // formuliert (Berechtigungen, Geschäftsregeln wie Urlaubssperren, fehlende
  // Konten) – sie soll unverändert bei der Person ankommen, die den Antrag
  // gestellt hat, statt hinter einer generischen Meldung zu verschwinden.
  if (code === "P0001" && error.message) {
    return error.message;
  }
  return "Die Daten konnten nicht geladen werden.";
}
