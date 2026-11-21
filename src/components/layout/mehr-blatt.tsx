"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Inbox,
  LayoutGrid,
  ListChecks,
  Megaphone,
  ScrollText,
  Search,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "@/context/session";
import { Avatar } from "@/components/ui/avatar";
import { TodoZahlMarke } from "@/components/kalender/todo-zaehler";
import { useWischZu } from "@/components/privat/blatt";
import { roleLabels } from "@/lib/nav";
import { suche } from "@/lib/suche";
import { useBegriffe } from "@/lib/begriffe";
import { cn } from "@/lib/utils";

interface Punkt {
  href: string;
  titel: string;
  text?: string;
  icon: LucideIcon;
  todo?: boolean;
}

/**
 * „Mehr“ auf dem Handy (Entwurf B + C): oben das eigene Profil und eine
 * Suche, die jede Seite und die wichtigsten Unterpunkte findet; darunter
 * für die Führung vier ruhige Kacheln und der Rest als Liste. Start, Plan,
 * Urlaub und Kalender stehen schon in der Leiste und fehlen hier. Ein Wisch
 * nach unten schließt.
 */
export function MehrBlatt({ onClose }: { onClose: () => void }) {
  const t = useBegriffe();
  const pathname = usePathname();
  const { role, profile } = useSession();
  const [frage, setFrage] = useState("");
  const blatt = useRef<HTMLDivElement>(null);
  useWischZu(blatt, true, onClose);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onClose]);

  const fuehrung = role === "shift_leader" || role === "admin";
  const protokoll = profile.protokoll === true;
  const treffer = useMemo(() => suche(frage, role, protokoll, t), [frage, role, protokoll, t]);

  const kacheln: Punkt[] = fuehrung
    ? [
        { href: "/verwaltung", titel: "Team", text: "Mitarbeiter, Gruppen", icon: Users },
        { href: "/besetzung", titel: "Besetzung", text: "Wer ist da?", icon: LayoutGrid },
        { href: "/urlaubsantraege", titel: "Anträge", text: "Urlaub entscheiden", icon: Inbox },
        { href: "/mitteilungen", titel: "Mitteilungen", text: "auch Urlaubssperren", icon: Megaphone },
      ]
    : [];
  const liste: Punkt[] = [
    { href: "/todos", titel: "To-dos", icon: ListChecks, todo: true },
    { href: "/meine-zahlen", titel: "Meine Zahlen", icon: Sparkles },
    ...(fuehrung ? [{ href: "/ausbildung", titel: "Ausbildung", icon: GraduationCap }] : []),
    ...(fuehrung && protokoll ? [{ href: "/protokoll", titel: "Protokoll", icon: ScrollText }] : []),
    ...(role === "admin" ? [{ href: "/auswertung", titel: "Auswertung", icon: BarChart3 }] : []),
    { href: "/hilfe", titel: "Hilfe", icon: BookOpen },
  ];

  const zeile = "flex h-10 items-center gap-3 px-3.5 text-[15px]";

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button className="absolute inset-0 bg-ink/20" aria-label="Menü schließen" onClick={onClose} />
      <div
        ref={blatt}
        data-mehr
        role="dialog"
        aria-label="Mehr"
        className="glas-dicht absolute inset-x-0 bottom-0 max-h-[94dvh] overflow-y-auto overscroll-contain rounded-t-[28px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-pop"
      >
        <div className="mx-auto max-w-xl space-y-2.5">
          <span aria-hidden className="mx-auto block h-[5px] w-9 rounded-full bg-ink/20" data-wisch-kopf />

          {/* Profil und Einstellungen */}
          <div className="flex items-center gap-2">
            <Link
              href="/einstellungen"
              onClick={onClose}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-[16px] bg-surface/60 px-3 py-2"
            >
              <Avatar employee={profile} className="h-9 w-9 text-[12px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold leading-tight">
                  {profile.firstName} {profile.lastName}
                </span>
                <span className="block truncate text-[12px] text-ink-muted">{roleLabels[role]} · Profil &amp; Einstellungen</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface/60 text-ink-muted"
              aria-label="Menü schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Suche über alle Bereiche und Unterpunkte */}
          <label className="flex h-10 items-center gap-2 rounded-[12px] bg-ink/[0.06] px-3 text-ink-muted focus-within:ring-2 focus-within:ring-brand-500/40">
            <Search className="h-4 w-4 shrink-0" />
            <input
              type="search"
              value={frage}
              onChange={(e) => setFrage(e.target.value)}
              placeholder="Suchen, z. B. „Sperre“ oder „Passwort“"
              aria-label="Im Menü suchen"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden"
              data-mehr-suche
            />
          </label>

          {frage.trim() ? (
            treffer.length ? (
              <ul className="overflow-hidden rounded-[14px] bg-surface/60" data-mehr-treffer>
                {treffer.map((e) => (
                  <li key={e.href + e.titel} className="border-t border-line first:border-t-0">
                    <Link href={e.href} onClick={onClose} className={cn(zeile, "h-auto py-2.5")}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{t(e.titel)}</span>
                        <span className="block truncate text-[12px] text-ink-muted">{e.wo}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 py-3 text-[14px] text-ink-muted">Nichts gefunden. Versuch ein anderes Wort.</p>
            )
          ) : (
            <>
              {kacheln.length ? (
                <div>
                  <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Führung</p>
                  <div data-mehr-kacheln className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {kacheln.map((k) => (
                      <Link
                        key={k.href}
                        href={k.href}
                        onClick={onClose}
                        className={cn(
                          "flex flex-col gap-0.5 rounded-[14px] border border-[var(--glas-rand)] bg-surface/60 px-3 py-2.5 hover:bg-surface/80",
                          pathname === k.href && "ring-1 ring-brand-500/50",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <k.icon className="h-[17px] w-[17px] shrink-0 text-ink-muted" strokeWidth={1.9} />
                          <span className="text-[14px] font-semibold leading-tight">{k.titel}</span>
                        </span>
                        <span className="text-[11.5px] leading-snug text-ink-muted">{k.text}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Weiteres</p>
                <ul className="overflow-hidden rounded-[14px] bg-surface/60">
                  {liste.map((p) => (
                    <li key={p.href} className="border-t border-line first:border-t-0">
                      <Link href={p.href} onClick={onClose} className={cn(zeile, pathname === p.href && "font-semibold text-brand-700")}>
                        <p.icon className="h-[18px] w-[18px] shrink-0 text-ink-muted" strokeWidth={1.9} />
                        <span className="min-w-0 flex-1 truncate">{t(p.titel)}</span>
                        {p.todo ? <TodoZahlMarke pfad={pathname} /> : null}
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
