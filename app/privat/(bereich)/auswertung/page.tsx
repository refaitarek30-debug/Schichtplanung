import { redirect } from "next/navigation";

/** Die Auswertung ist jetzt der Reiter „Übersicht“ unter Schichten. */
export default function Seite() {
  redirect("/privat/schichten");
}
