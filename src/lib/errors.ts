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
  // Der Dienst selbst ist weg: Zeitüberschreitung, abgebrochene Verbindung
  // oder ein 5xx vom Anbieter. Das ist kein Eingabefehler, und der
  // Sammelsatz weiter unten liest sich sonst wie „du hast etwas falsch
  // gemacht". Wer das hier sieht, soll wissen: nichts tun, kurz warten.
  if (
    (error.status !== undefined && error.status >= 500) ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("upstream") ||
    message.includes("service unavailable") ||
    message.includes("gateway")
  ) {
    return (
      "Der Anmeldedienst antwortet gerade nicht. Das liegt nicht an deinen " +
      "Zugangsdaten – bitte in ein bis zwei Minuten erneut versuchen."
    );
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

type FehlerInfo = { message?: string; code?: string; status?: number } | null | undefined;

/**
 * Meldung, wenn der Dienst tatsächlich überlastet oder nicht erreichbar ist.
 * Ohne technische Einzelheiten – die helfen der Person vor dem Bildschirm
 * nicht weiter.
 */
export const STOERUNG_MELDUNG =
  "Der Dienst ist gerade überlastet oder nicht erreichbar. Bitte in einigen Minuten erneut versuchen.";

/**
 * Ist das eine echte, vorübergehende Kapazitäts- oder Verbindungsstörung?
 *
 * Nur dann soll „bitte später erneut versuchen“ erscheinen. Viele
 * gleichzeitige Benutzer sind für sich kein Fehler – die App kennt keine
 * eigene Benutzergrenze. Gezählt wird ausschließlich, was Datenbank,
 * PostgREST oder das Netz selbst als Überlastung oder Ausfall melden:
 *   * HTTP 429 (Rate-Limit), 502/503/504 (Gateway, Dienst weg, Zeitüberschreitung)
 *   * PGRST000–003: keine Verbindung zur Datenbank, Verbindungspool erschöpft
 *   * Postgres 53xxx (zu wenig Ressourcen, z. B. 53300 zu viele Verbindungen),
 *     08xxx (Verbindung abgebrochen), 57014 (Zeitlimit), 57P01–03 (Neustart)
 *   * Netzfehler des Browsers (Failed to fetch, Load failed …)
 * Eine Geschäftsregel aus der Datenbank (P0001) ist nie eine Störung.
 */
export function istVoruebergehendeStoerung(error: FehlerInfo): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  if (code === "P0001") return false;
  const status = error.status ?? 0;
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  if (/^PGRST00[0-3]$/.test(code)) return true;
  if (/^(53|08)/.test(code)) return true;
  if (code === "57014" || /^57P0[1-3]$/.test(code)) return true;
  const message = (error.message ?? "").toLowerCase();
  return [
    "failed to fetch",
    "fetch failed",
    "networkerror",
    "network request failed",
    "load failed",
    "timed out",
    "timeout",
    "too many connections",
    "too many requests",
    "rate limit",
    "service unavailable",
    "bad gateway",
    "gateway timeout",
    "upstream",
    "econnreset",
    "econnrefused",
    "socket hang up",
  ].some((muster) => message.includes(muster));
}

/** Fehler bei Datenzugriffen – inklusive abgewiesener RLS-Zugriffe. */
export function dataErrorMessage(error: FehlerInfo | null) {
  if (!error) return null;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (code === "42501" || message.includes("row-level security")) {
    return "Du hast keine Berechtigung für diesen Bereich.";
  }
  if (code === "PGRST301" || message.includes("jwt expired")) {
    return "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.";
  }
  if (istVoruebergehendeStoerung(error)) {
    return STOERUNG_MELDUNG;
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
