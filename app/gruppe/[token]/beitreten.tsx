"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { gruppeBeitreten, gruppeInfo, type GruppenEinladung } from "@/lib/data/gruppen";

type Stand =
  | { art: "laedt" }
  | { art: "abgemeldet" }
  | { art: "einladung"; info: GruppenEinladung }
  | { art: "fehler"; text: string };

export function GruppeBeitreten({ token }: { token: string }) {
  const router = useRouter();
  const [stand, setStand] = useState<Stand>({ art: "laedt" });
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const weiter = `/gruppe/${token}`;

  useEffect(() => {
    let aus = false;
    (async () => {
      if (!isSupabaseConfigured) return setStand({ art: "fehler", text: "Gerade nicht verfügbar." });
      const { data } = await createClient().auth.getUser();
      if (aus) return;
      if (!data.user) return setStand({ art: "abgemeldet" });
      try {
        const info = await gruppeInfo(token);
        if (!aus) setStand({ art: "einladung", info });
      } catch (e) {
        if (!aus) setStand({ art: "fehler", text: e instanceof Error ? e.message : "Die Einladung konnte nicht geladen werden." });
      }
    })();
    return () => {
      aus = true;
    };
  }, [token]);

  async function beitreten() {
    setLaeuft(true);
    setFehler(null);
    try {
      await gruppeBeitreten(token);
      router.replace("/start");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das Beitreten hat nicht geklappt.");
      setLaeuft(false);
    }
  }

  return (
    <main className="privat flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="glas-dicht w-full max-w-sm space-y-5 rounded-[28px] p-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#22A06B]/15 text-[#1f7a52]">
          <Users className="h-8 w-8" />
        </span>

        {stand.art === "laedt" ? <div className="mx-auto h-16 w-full animate-pulse rounded-2xl bg-ink/[0.06]" /> : null}

        {stand.art === "abgemeldet" ? (
          <>
            <div>
              <h1 className="text-[24px] font-bold tracking-tight">Du wurdest in eine Gruppe eingeladen</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
                In der Gruppe seht ihr, wann wer arbeitet – und wann ihr alle frei habt. Dafür brauchst du einen eigenen
                Schichtkalender.
              </p>
            </div>
            <div className="space-y-2">
              <Link
                href={`/login?weiter=${encodeURIComponent(weiter)}`}
                className="flex h-12 items-center justify-center rounded-full bg-brand-500 text-[16px] font-semibold text-white"
              >
                Anmelden und beitreten
              </Link>
              <Link
                href="/privat/registrieren"
                className="flex h-12 items-center justify-center rounded-full bg-surface text-[16px] font-semibold text-brand-600 ring-1 ring-line"
              >
                Kostenlos Kalender anlegen
              </Link>
              <p className="text-[12.5px] text-ink-muted">Danach diesen Link noch einmal öffnen.</p>
            </div>
          </>
        ) : null}

        {stand.art === "einladung" ? (
          <>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Einladung</p>
              <h1 className="mt-1 text-[26px] font-bold tracking-tight">{stand.info.name}</h1>
              <p className="mt-1 text-[14px] text-ink-muted">
                {stand.info.mitglieder === 1 ? "1 Person" : `${stand.info.mitglieder} Personen`}
              </p>
            </div>
            {stand.info.dabei ? (
              <>
                <p className="text-[15px] text-ink-muted">Du bist schon in dieser Gruppe.</p>
                <Link href="/start" className="flex h-12 items-center justify-center rounded-full bg-brand-500 text-[16px] font-semibold text-white">
                  Zum Kalender
                </Link>
              </>
            ) : stand.info.darf ? (
              <>
                <p className="text-[14px] leading-relaxed text-ink-muted">
                  Die anderen sehen, wann du arbeitest oder frei hast – ohne Gründe und ohne Termine. Austreten geht
                  jederzeit unter „Teilen“.
                </p>
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => void beitreten()}
                  className="h-12 w-full rounded-full bg-brand-500 text-[16px] font-semibold text-white disabled:opacity-60"
                >
                  {laeuft ? "Einen Moment …" : "Beitreten"}
                </button>
              </>
            ) : (
              <p className="text-[14.5px] text-ink-muted">
                Mit diesem Konto gibt es keinen eigenen Schichtkalender. Melde dich mit deinem Kalender-Konto an.
              </p>
            )}
            {fehler ? <p className="rounded-xl bg-crit-bg px-3 py-2 text-[14px] text-crit-fg">{fehler}</p> : null}
          </>
        ) : null}

        {stand.art === "fehler" ? (
          <div>
            <h1 className="text-[20px] font-bold">Diese Einladung gilt nicht mehr</h1>
            <p className="mt-2 text-[14.5px] text-ink-muted">{stand.text} Frag nach einem neuen Link.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
