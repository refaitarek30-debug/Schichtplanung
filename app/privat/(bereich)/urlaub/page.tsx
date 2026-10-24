import { redirect } from "next/navigation";

/** Der Urlaubs-Planer ist jetzt ein Bereich unter „Schichten“. */
export default function Seite() {
  redirect("/privat/schichten?reiter=urlaub");
}
