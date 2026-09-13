/**
 * Rückgabe aller Formular-Aktionen. Steht bewusst in einer eigenen Datei:
 * Module mit "use server" dürfen nur asynchrone Funktionen ausliefern,
 * und andere Dateien brauchen den Typ trotzdem.
 */
export interface FormState {
  error?: string;
  success?: string;
  /**
   * Einladungslink zum Weitergeben. Wird gefüllt, wenn der Mailversand
   * nicht möglich war – dann kann die Führung den Link selbst übermitteln,
   * statt auf eine Mail zu warten, die nie ankommt.
   */
  link?: string;
}
