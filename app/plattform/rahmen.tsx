"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, ClipboardList, KeyRound, LogOut, MessageSquareText, Trash2, Users } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const BEREICHE = [
  { pfad: "/plattform", text: "Übersicht", icon: BarChart3 },
  { pfad: "/plattform/firmen", text: "Firmen & Konten", icon: Building2 },
  { pfad: "/plattform/zugang", text: "Zugänge & Support", icon: KeyRound },
  { pfad: "/plattform/umfrage", text: "Umfrage", icon: MessageSquareText },
  { pfad: "/plattform/loeschen", text: "Löschen", icon: Trash2 },
  { pfad: "/plattform/protokoll", text: "Protokoll", icon: ClipboardList },
  { pfad: "/plattform/team", text: "Team", icon: Users },
];

/**
 * Rahmen der Betreiber-Konsole: eigenes Menü, kein Kalender, kein
 * Privatbereich. Am Computer links eine dunkle Leiste, am Handy oben eine
 * Zeile zum Wischen.
 */
export function KonsoleRahmen({ email, nurLesen, children }: { email: string; nurLesen: boolean; children: React.ReactNode }) {
  const pfad = usePathname();
  const aktiv = (p: string) => (p === "/plattform" ? pfad === p : pfad.startsWith(p));
  return (
    <div className="min-h-screen bg-surface-sunken lg:pl-[248px]" data-konsole>
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-white/5 bg-[#18181b] px-3 pb-3 pt-5 text-[#e4e4e7] lg:flex">
        <div className="px-2.5 pb-4">
          <p className="text-[16px] font-semibold tracking-tight text-white">ShiftNexo</p>
          <p className="text-[12px] text-[#a1a1aa]">Betreiber-Konsole</p>
        </div>
        <nav aria-label="Konsole" className="flex flex-col gap-0.5">
          {BEREICHE.map(({ pfad: p, text, icon: Icon }) => (
            <Link
              key={p}
              href={p}
              aria-current={aktiv(p) ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-[14px]", aktiv(p) ? "bg-[#27272a] text-white" : "text-[#d4d4d8] hover:bg-white/5")}
            >
              <Icon className="h-[18px] w-[18px] text-[#a1a1aa]" strokeWidth={1.7} />
              {text}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-[12px] border border-white/10 p-3">
          <p className="truncate text-[13px] font-medium text-white" title={email}>
            {email}
          </p>
          <p className={cn("mt-0.5 text-[12px]", nurLesen ? "text-amber-300" : "text-[#a1a1aa]")}>{nurLesen ? "Notfallzugang · nur lesen" : "Voller Zugriff"}</p>
          <form action={signOut} className="mt-2">
            <button type="submit" className="flex items-center gap-2 text-[13px] text-[#f87171]">
              <LogOut className="h-4 w-4" strokeWidth={1.7} /> Abmelden
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#18181b] text-[#e4e4e7] lg:hidden">
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <p className="text-[15px] font-semibold text-white">
            ShiftNexo <span className="font-normal text-[#a1a1aa]">Konsole</span>
          </p>
          <form action={signOut}>
            <button type="submit" className="text-[13px] text-[#f87171]">
              Abmelden
            </button>
          </form>
        </div>
        <nav aria-label="Konsole" className="flex gap-1 overflow-x-auto px-3 pb-2.5 pt-1.5">
          {BEREICHE.map(({ pfad: p, text }) => (
            <Link
              key={p}
              href={p}
              aria-current={aktiv(p) ? "page" : undefined}
              className={cn("shrink-0 rounded-full px-3 py-1.5 text-[13px]", aktiv(p) ? "bg-white text-[#18181b]" : "text-[#d4d4d8]")}
            >
              {text}
            </Link>
          ))}
        </nav>
      </header>

      {nurLesen ? (
        <p className="border-b border-line bg-warn-bg px-4 py-2.5 text-[13.5px] font-semibold text-warn-fg sm:px-6" data-notfallzugang>
          Notfallzugang – nur lesen. Ändern, löschen und Codes erzeugen ist gesperrt. Diese Öffnung wird festgehalten.
        </p>
      ) : null}
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
