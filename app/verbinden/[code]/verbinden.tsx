"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CodeEingeben } from "@/components/kalender/verbinden";
import { EinladungKonto } from "@/components/privat/einladung-konto";

export interface Vorschau {
  gueltig: boolean;
  /** Vorname der einladenden Person. */
  name: string;
}

export function Verbinden({ code, vorschau, neu }: { code: string; vorschau: Vorschau | null; neu: boolean }) {
  const router = useRouter();
  const [stand, setStand] = useState<"laedt" | "abgemeldet" | "angemeldet" | "fertig">("laedt");
  const name = vorschau?.name || "";

  useEffect(() => {
    let aus = false;
    (async () => {
      if (!isSupabaseConfigured) return setStand("abgemeldet");
      const { data } = await createClient().auth.getUser();
      if (!aus) setStand(data.user ? "angemeldet" : "abgemeldet");
    })();
    return () => {
      aus = true;
    };
  }, []);

  return (
    <main className="privat flex min-h-dvh items-center justify-center px-3 py-10">
      <div className="glas-dicht w-full max-w-sm space-y-5 rounded-[28px] py-6">
        <div className="space-y-2 px-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#22A06B]/15 text-[#1f7a52]">
            <Link2 className="h-8 w-8" />
          </span>
          <h1 className="text-[24px] font-bold tracking-tight text-balance">
            {stand === "abgemeldet" && vorschau?.gueltig !== false
              ? name
                ? `${name} lädt dich ein 💛`
                : "Du wurdest eingeladen 💛"
              : "Kalender verbinden"}
          </h1>
        </div>

        {stand === "laedt" ? <div className="mx-6 h-16 animate-pulse rounded-2xl bg-ink/[0.06]" /> : null}

        {stand === "abgemeldet" && vorschau?.gueltig === false ? (
          <div className="space-y-3 px-6 text-center">
            <p className="text-[15px] leading-relaxed text-ink-muted">
              Dieser Einladungslink ist abgelaufen oder wurde schon benutzt. Bitte frag nach einem neuen Link.
            </p>
            <Link href="/login" className="block text-[14px] font-semibold text-brand-600">
              Ich habe schon ein Konto
            </Link>
          </div>
        ) : null}

        {stand === "abgemeldet" && vorschau?.gueltig !== false ? (
          <div className="space-y-4 px-6">
            <p className="text-center text-[15px] leading-relaxed text-ink-muted">
              Leg dir kurz deinen eigenen Kalender an – danach seht ihr gegenseitig eure Schichten.
            </p>
            <EinladungKonto weiter={`/verbinden/${code}?neu=1`} knopf={name ? `Konto anlegen und mit ${name} verbinden` : "Konto anlegen und verbinden"} />
          </div>
        ) : null}

        {stand === "angemeldet" ? <CodeEingeben start={code} sofort={neu} onVerbunden={() => setStand("fertig")} /> : null}

        {stand === "fertig" ? (
          <div className="space-y-3 px-6 text-center">
            <p className="text-[16px] font-semibold">Ihr seid verbunden 🎉</p>
            <p className="text-[14px] text-ink-muted">
              Unter Teilen stellst du ein, ob die andere Person deine Termine sieht oder bei dir eintragen darf.
            </p>
            <button
              type="button"
              onClick={() => router.replace("/start")}
              className="h-12 w-full rounded-full bg-brand-500 text-[16px] font-semibold text-white"
            >
              Zum Kalender
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
