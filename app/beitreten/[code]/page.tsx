import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { datenFehlerText } from "@/lib/errors";
import { Beitreten, type BeitrittVorschau } from "./beitreten";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Einem Betrieb beitreten – ShiftNexo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Beitritt mit dem bestehenden Konto (Migration 0194): Link oder Code aus dem
 * Betrieb. Vorher die Übernahme-Frage – was im Betrieb mit erscheinen soll.
 */
export default async function BeitretenCodeSeite({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let vorschau: BeitrittVorschau | null = null;
  let fehler = "Gerade nicht möglich.";
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("beitritt_vorschau", { p_code: code });
    const zeile = (Array.isArray(data) ? data[0] : data) as BeitrittVorschau | undefined;
    if (!error && zeile) vorschau = zeile;
    else fehler = datenFehlerText(error, "Dieser Code ist ungültig oder abgelaufen. Bitte frag im Betrieb nach einem neuen.");
  }
  if (!vorschau) {
    return (
      <main className="privat flex min-h-dvh items-center justify-center px-3 py-10">
        <div className="glas w-full max-w-md rounded-[28px] p-6 text-center">
          <h1 className="text-[22px] font-bold">Beitritt nicht möglich</h1>
          <p className="mt-2 text-[15px] text-ink-muted">{fehler}</p>
          <Link href="/start" className="mt-5 inline-flex h-11 items-center rounded-[16px] bg-brand-600 px-5 text-[15px] font-semibold text-white">
            Zurück
          </Link>
        </div>
      </main>
    );
  }
  return <Beitreten code={code} vorschau={vorschau} />;
}
