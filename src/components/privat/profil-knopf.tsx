"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, LogOut, Settings } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { wechsleBereich } from "@/lib/bereich";
import { leereZwischenspeicher } from "@/lib/zwischenspeicher";
import { forgetIdentity } from "@/lib/supabase/identity";
import { Blatt } from "./blatt";
import { usePrivat } from "./kontext";

/** Initialen aus dem Namen („Tarek Refai“ → „TR“, „tarek“ → „T“). */
function initialen(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  const z = teile.length > 1 ? teile[0]![0]! + teile[teile.length - 1]![0]! : (teile[0]?.[0] ?? "?");
  return z.toUpperCase();
}

/**
 * Profil oben im Kalender des Privatbereichs: ein Tipp öffnet ein kleines
 * Blatt – zum Betrieb wechseln (oder beitreten), Einstellungen, Abmelden.
 */
export function PrivatProfilKnopf() {
  const { konto, betrieb } = usePrivat();
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const zeile = "flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium";
  const symbol = "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-white";

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        aria-label="Profil"
        data-privat-profil
        className="glas flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/[0.07] text-[12px] font-semibold">{initialen(konto.name)}</span>
      </button>
      {offen ? (
        <Blatt titel={konto.name} onClose={() => setOffen(false)}>
          <p className="-mt-1 pb-3 text-[13.5px] text-ink-muted">Privatbereich{betrieb ? ` · auch bei ${betrieb.firma}` : ""}</p>
          <div className="glas divide-y divide-line overflow-hidden rounded-[18px]" data-privat-profil-blatt>
            {betrieb ? (
              <button type="button" className={zeile} onClick={() => wechsleBereich("betrieb", router)} data-profil-zum-betrieb>
                <span className={`${symbol} bg-[#1d4ed8]`}>
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">Zum Betrieb</span>
                  <span className="block truncate text-[12.5px] font-normal text-ink-muted">{betrieb.firma}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-ink-faint" />
              </button>
            ) : (
              <Link href="/beitreten" className={zeile}>
                <span className={`${symbol} bg-[#1d4ed8]`}>
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="flex-1">Einem Betrieb beitreten</span>
                <ChevronRight className="h-4 w-4 text-ink-faint" />
              </Link>
            )}
            <Link href="/privat/mehr" className={zeile} onClick={() => setOffen(false)} data-profil-einstellungen>
              <span className={`${symbol} bg-[#64748b]`}>
                <Settings className="h-4 w-4" />
              </span>
              <span className="flex-1">Einstellungen</span>
              <ChevronRight className="h-4 w-4 text-ink-faint" />
            </Link>
            <form
              action={signOut}
              onSubmit={() => {
                leereZwischenspeicher();
                forgetIdentity();
              }}
            >
              <button type="submit" className={zeile}>
                <span className={`${symbol} bg-ink/[0.08] text-ink-muted`}>
                  <LogOut className="h-4 w-4" />
                </span>
                <span className="flex-1">Abmelden</span>
              </button>
            </form>
          </div>
        </Blatt>
      ) : null}
    </>
  );
}
