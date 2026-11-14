import { konsoleZugang } from "@/lib/auth/konsole";
import { Seitenkopf } from "../tabelle";
import { SupportCode } from "../support-code";
import { ZugangVerwalten, type Sperre } from "../zugang";

export const metadata = { title: "Zugänge & Support · Betreiber-Konsole" };
export const dynamic = "force-dynamic";

/** Gesperrte Konten, Zwei-Faktor zurücksetzen, Passwort-Code für Privatkonten. */
export default async function KonsoleZugang() {
  const k = await konsoleZugang();
  const { data: sperren } = await k.admin.rpc("platform_sperren");
  return (
    <>
      <Seitenkopf titel="Zugänge & Support" text="Hilfe, wenn jemand nicht mehr hineinkommt. Nur wenn sicher ist, dass die Anfrage von der Person selbst kommt." />
      <ZugangVerwalten sperren={(sperren as Sperre[] | null) ?? []} nurLesen={k.nurLesen} />
      {k.nurLesen ? null : <SupportCode />}
    </>
  );
}
