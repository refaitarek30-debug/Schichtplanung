"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronUp, CircleHelp, Cog, Home, LockKeyhole, LogOut, ShieldCheck, TrendingUp, UserRound } from "lucide-react";
import { useSession } from "@/context/session";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/lib/auth/actions";
import { meinZweiFaktorStatus } from "@/lib/auth/zwei-faktor-actions";
import { vergissAenderungsstand } from "@/lib/live-refresh";
import { roleLabels } from "@/lib/nav";
import { forgetIdentity } from "@/lib/supabase/identity";
import { leereZwischenspeicher } from "@/lib/zwischenspeicher";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BetreiberLink } from "./betreiber-link";
import { usePrivatWechsel } from "./bereich";
import { StartAnsichtSchalter } from "./start-ansicht-schalter";

const ROLLEN: Role[] = ["employee", "shift_leader", "admin"];
const ZEILE = "flex w-full min-w-0 items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] text-zinc-200 hover:bg-white/5";
const ICON = "h-4 w-4 shrink-0 text-zinc-400";

/**
 * Konto unten in der Seitenleiste am Computer (Entwurf B): ein Knopf mit
 * Bild und Name, darüber geht das Konto-Menü auf – Profil, Sicherheit,
 * Einstellungen, Datenschutz, Privatbereich, Startseite, Ansicht, Abmelden.
 */
export function KontoMenue({ eingeklappt }: { eingeklappt: boolean }) {
  const { mode, role, profile, company, echteRolle, ansicht, setAnsicht } = useSession();
  const [offen, setOffen] = useState(false);
  const [zweiFaktor, setZweiFaktor] = useState<boolean | null>(null);
  const wurzel = useRef<HTMLDivElement>(null);
  const privat = usePrivatWechsel(profile.hatPrivat === true);
  const ansichten = ROLLEN.filter((r) => r !== echteRolle && ROLLEN.indexOf(r) < ROLLEN.indexOf(echteRolle));

  useEffect(() => {
    if (!offen) return;
    const klick = (e: MouseEvent) => !wurzel.current?.contains(e.target as Node) && setOffen(false);
    const taste = (e: KeyboardEvent) => e.key === "Escape" && setOffen(false);
    document.addEventListener("mousedown", klick);
    document.addEventListener("keydown", taste);
    if (mode === "live" && zweiFaktor === null) {
      meinZweiFaktorStatus()
        .then((s) => setZweiFaktor(s?.aktiv ?? null))
        .catch(() => {});
    }
    return () => {
      document.removeEventListener("mousedown", klick);
      document.removeEventListener("keydown", taste);
    };
  }, [offen, mode, zweiFaktor]);

  const zu = () => setOffen(false);

  return (
    <div className="relative px-2 pb-2" ref={wurzel} data-konto-menue>
      {offen ? (
        <div className="absolute bottom-full left-2 z-30 mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-[14px] border border-white/10 bg-[#202023] p-1.5 text-zinc-200 shadow-pop" role="menu">
          <div className="border-b border-white/10 px-2.5 pb-2.5 pt-1.5">
            <p className="truncate text-[14px] font-semibold text-white">
              {profile.firstName} {profile.lastName}
            </p>
            <p className="truncate text-[12px] text-zinc-400">
              {roleLabels[role]}
              {company.name ? ` · ${company.name}` : ""}
            </p>
          </div>
          <div className="py-1">
            <Eintrag href="/profil" onClick={zu} icon={<UserRound className={ICON} strokeWidth={1.7} />} text="Profil & Stammdaten" />
            <Eintrag
              href="/profil"
              onClick={zu}
              icon={<ShieldCheck className={ICON} strokeWidth={1.7} />}
              text="Sicherheit"
              rechts={zweiFaktor === null ? undefined : zweiFaktor ? "Zwei-Faktor an" : "aus"}
            />
            <Eintrag href="/einstellungen" onClick={zu} icon={<Cog className={ICON} strokeWidth={1.7} />} text="Einstellungen" />
            <Eintrag href="/meine-zahlen" onClick={zu} icon={<TrendingUp className={ICON} strokeWidth={1.7} />} text="Meine Zahlen" />
            <Eintrag href="/profil/datenschutz" onClick={zu} icon={<LockKeyhole className={ICON} strokeWidth={1.7} />} text="Datenschutz & meine Daten" />
            <Eintrag href="/hilfe" onClick={zu} icon={<CircleHelp className={ICON} strokeWidth={1.7} />} text="Hilfe" />
            <BetreiberLink onClick={zu} className={cn(ZEILE, "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-zinc-400")} />
            {mode !== "demo" && !company.isDemo ? (
              <button
                type="button"
                onClick={() => {
                  zu();
                  privat.wechseln();
                }}
                className={ZEILE}
              >
                <Home className={ICON} strokeWidth={1.7} />
                <span className="min-w-0 flex-1 truncate">Zum Privatbereich</span>
              </button>
            ) : null}
          </div>
          <div className="border-t border-white/10 px-1.5 py-2">
            <p className="px-1 pb-1.5 text-[11px] font-semibold text-zinc-500">Startseite</p>
            <StartAnsichtSchalter klein />
          </div>
          {ansichten.length > 0 ? (
            <div className="border-t border-white/10 py-1">
              <p className="px-2.5 py-1 text-[11px] font-semibold text-zinc-500">Ansicht</p>
              {[echteRolle, ...ansichten].map((wert) => {
                const aktiv = (ansicht ?? echteRolle) === wert;
                return (
                  <button
                    key={wert}
                    type="button"
                    onClick={() => {
                      setAnsicht(wert === echteRolle ? null : wert);
                      zu();
                    }}
                    className={cn(ZEILE, aktiv && "font-semibold text-white")}
                  >
                    <span className="min-w-0 flex-1 truncate">{wert === echteRolle ? `${roleLabels[wert]} (meine Rolle)` : `Als ${roleLabels[wert]} ansehen`}</span>
                    {aktiv ? <span className="shrink-0 text-[11.5px] text-zinc-400">aktiv</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {mode !== "demo" ? (
            <form
              action={signOut}
              onSubmit={() => {
                setAnsicht(null);
                leereZwischenspeicher();
                forgetIdentity();
                vergissAenderungsstand();
              }}
              className="border-t border-white/10 pt-1"
            >
              <button type="submit" className={cn(ZEILE, "text-red-400")}>
                <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                Abmelden
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        aria-haspopup="menu"
        aria-label="Konto-Menü"
        className={cn(
          "flex w-full min-w-0 items-center gap-2.5 rounded-[12px] border border-white/10 py-1.5 text-left text-white hover:bg-white/5",
          eingeklappt ? "justify-center px-1" : "pl-1.5 pr-2.5",
        )}
      >
        <Avatar employee={profile} className="h-8 w-8 shrink-0 bg-white/10 text-[12px] text-white" />
        {eingeklappt ? null : (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13.5px] font-medium">
                {profile.firstName} {profile.lastName}
              </span>
              <span className="block truncate text-[11.5px] text-zinc-400">{roleLabels[role]}</span>
            </span>
            <ChevronUp className={cn("h-4 w-4 shrink-0 text-zinc-400 transition-transform", !offen && "rotate-180")} />
          </>
        )}
      </button>
      {privat.fenster}
    </div>
  );
}

function Eintrag({ href, onClick, icon, text, rechts }: { href: string; onClick: () => void; icon: ReactNode; text: string; rechts?: string }) {
  return (
    <Link href={href} onClick={onClick} className={ZEILE} role="menuitem">
      {icon}
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {rechts ? <span className="shrink-0 text-[11.5px] text-zinc-400">{rechts}</span> : null}
    </Link>
  );
}
