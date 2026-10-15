import { hatFunktionServer } from "@/lib/server/funktion";
import { MeinKalenderSeite } from "./seite";

// Die Freischaltung hängt an der angemeldeten Person – nie vorab bauen.
export const dynamic = "force-dynamic";

/**
 * Mein Kalender. Ob der neue Kalender gilt, wird schon auf dem Server
 * geprüft – so blitzt nie kurz der falsche auf.
 */
export default async function Page() {
  const neu = await hatFunktionServer("kalender_neu");
  return <MeinKalenderSeite neu={neu} />;
}
