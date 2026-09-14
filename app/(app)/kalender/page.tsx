import { redirect } from "next/navigation";

/**
 * Der Kalender ist als zweite Ansicht in den Schichtplan gewandert – beide
 * zeigten dieselben Daten aus zwei Richtungen und standen doppelt in der
 * Navigation. Die Weiterleitung bleibt stehen, weil alte Lesezeichen, der
 * Startbildschirm auf dem Handy und die installierte PWA weiter auf
 * `/kalender` zeigen können.
 */
export default function KalenderPage() {
  redirect("/schichtplan");
}
