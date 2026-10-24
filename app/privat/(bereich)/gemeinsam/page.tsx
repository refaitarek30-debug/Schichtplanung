import { redirect } from "next/navigation";

/** „Gemeinsam frei“ ist jetzt ein Bereich unter „Schichten“. */
export default function Seite() {
  redirect("/privat/schichten?reiter=gemeinsam");
}
