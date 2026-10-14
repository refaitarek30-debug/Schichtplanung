"use client";

import { useState } from "react";
import { Heart, Smartphone, UserPlus } from "lucide-react";
import { KalenderTeilen } from "@/components/kalender/teilen";
import { KalenderAboCard } from "@/components/settings/kalender-abo-card";
import { usePrivat } from "./kontext";
import { PrivatKarte, PrivatKopf } from "./rahmen";

/** Partner einladen und Kalender-Abo fürs Handy. */
export function PrivatTeilen() {
  const { konto } = usePrivat();
  const [einladen, setEinladen] = useState(false);
  const vorname = konto.name.split(/\s+/)[0] ?? konto.name;

  return (
    <div className="space-y-4">
      <PrivatKopf titel="Teilen" unter="Mit deinem Partner und mit dem Kalender deines Handys." />

      <PrivatKarte>
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Heart className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold">Partner einladen</h2>
            <p className="mt-0.5 text-[14px] text-ink-muted">
              Dein Partner sieht deine Schichten über einen Link – ohne eigenes Konto – und kann seine eigenen
              Arbeitstage und Termine eintragen. Die erscheinen dann auch bei dir.
            </p>
            <button
              type="button"
              onClick={() => setEinladen(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-[14px] font-semibold text-white"
            >
              <UserPlus className="h-4 w-4" /> Einladen
            </button>
          </div>
        </div>
      </PrivatKarte>

      <div className="flex items-center gap-2 pt-2 text-[13px] font-semibold text-ink-muted">
        <Smartphone className="h-4 w-4" /> Im Kalender deines Handys
      </div>
      <KalenderAboCard />

      {einladen ? <KalenderTeilen vorname={vorname} onClose={() => setEinladen(false)} /> : null}
    </div>
  );
}
