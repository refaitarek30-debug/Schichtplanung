import { redirect } from "next/navigation";

/**
 * Mitarbeiter, Schichten und Regeln liegen jetzt unter /verwaltung auf
 * einer Seite mit Reitern. Die Weiterleitung bleibt stehen, weil alte
 * Lesezeichen und die installierte PWA weiter auf den alten Pfad zeigen
 * können.
 */
export default function RegelnRedirect() {
  redirect("/verwaltung?bereich=regeln");
}
