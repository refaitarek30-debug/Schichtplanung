"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CodeEingeben } from "@/components/kalender/verbinden";

export function Verbinden({ code }: { code: string }) {
  const router = useRouter();
  const [stand, setStand] = useState<"laedt" | "abgemeldet" | "angemeldet" | "fertig">("laedt");
  const weiter = `/verbinden/${code}`;

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
          <h1 className="text-[24px] font-bold tracking-tight">Kalender verbinden</h1>
        </div>

        {stand === "laedt" ? <div className="mx-6 h-16 animate-pulse rounded-2xl bg-ink/[0.06]" /> : null}

        {stand === "abgemeldet" ? (
          <div className="space-y-3 px-6 text-center">
            <p className="text-[15px] leading-relaxed text-ink-muted">
              Verbunden seht ihr gegenseitig eure Schichten. Dafür brauchst du einen eigenen Schichtkalender.
            </p>
            <Link
              href={`/login?weiter=${encodeURIComponent(weiter)}`}
              className="flex h-12 items-center justify-center rounded-full bg-brand-500 text-[16px] font-semibold text-white"
            >
              Anmelden und verbinden
            </Link>
            <Link
              href="/privat/registrieren"
              className="flex h-12 items-center justify-center rounded-full bg-surface text-[16px] font-semibold text-brand-600 ring-1 ring-line"
            >
              Kostenlos Kalender anlegen
            </Link>
            <p className="text-[12.5px] text-ink-muted">Danach den Link noch einmal öffnen.</p>
          </div>
        ) : null}

        {stand === "angemeldet" ? <CodeEingeben start={code} onVerbunden={() => setStand("fertig")} /> : null}

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
