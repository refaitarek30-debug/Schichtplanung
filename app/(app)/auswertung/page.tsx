import { redirect } from "next/navigation";

/** Die Auswertung gibt es nicht mehr (Datenschutz). Alte Lesezeichen landen auf der Startseite. */
export default function AuswertungWeg() {
  redirect("/dashboard");
}
