import { redirect } from "next/navigation";

/** Kurzform aus der Spezifikation – zeigt auf die bestehende Seite. */
export default function RequestsAlias() {
  redirect("/urlaubsantraege");
}
