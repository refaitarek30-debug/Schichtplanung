import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { PrivatWeiter } from "./privat-weiter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privat weitermachen? – ShiftNexo",
  robots: { index: false, follow: false },
};

/**
 * Nach dem Austritt (Zugang im Betrieb deaktiviert, Migration 0194): Beim
 * nächsten Anmelden kommt die Frage, ob die Person ShiftNexo privat weiter
 * nutzen möchte.
 */
export default async function PrivatWeiterSeite() {
  if (!isSupabaseConfigured) redirect("/login");
  const supabase = await createClient();
  const { data } = await supabase.rpc("austritt_stand");
  const stand = (Array.isArray(data) ? data[0] : data) as
    | { ausgetreten: boolean; firma: string | null; hat_privat: boolean; erledigt: boolean }
    | null
    | undefined;
  if (!stand?.ausgetreten) redirect("/start");
  if (stand.erledigt && stand.hat_privat) redirect("/privat");
  return <PrivatWeiter firma={stand.firma} hatPrivat={stand.hat_privat} />;
}
