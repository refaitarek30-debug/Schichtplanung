"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Ellipsis, Layers, ListChecks, Users } from "lucide-react";
import { offeneBisHeute } from "@/components/kalender/todo-zaehler";
import { fetchTodos } from "@/lib/data/todos";
import { heuteInBerlin } from "@/lib/dates";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/privat", text: "Kalender", icon: CalendarDays },
  { href: "/privat/schichten", text: "Schichten", icon: Layers },
  { href: "/privat/teilen", text: "Teilen", icon: Users },
  { href: "/privat/todos", text: "To-dos", icon: ListChecks },
  { href: "/privat/mehr", text: "Mehr", icon: Ellipsis },
];

/** Offene To-dos bis heute – für die Zahl am Reiter; lädt neu bei Seitenwechsel und wenn sich To-dos ändern. */
function useTodoZahl(pfad: string): number {
  const [zahl, setZahl] = useState(0);
  useEffect(() => {
    let aktiv = true;
    const laden = () => {
      fetchTodos()
        .then((t) => aktiv && setZahl(offeneBisHeute(t, heuteInBerlin())))
        .catch(() => {});
    };
    laden();
    window.addEventListener("todos-geaendert", laden);
    return () => {
      aktiv = false;
      window.removeEventListener("todos-geaendert", laden);
    };
  }, [pfad]);
  return zahl;
}

/** Rahmen des Privatbereichs: Inhalt und Leiste unten – auf jeder Bildschirmgröße. */
export function PrivatRahmen({ children }: { children: ReactNode }) {
  const pfad = usePathname();
  const todoZahl = useTodoZahl(pfad);
  return (
    <div className="privat min-h-dvh">
      <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        {children}
      </main>
      {/* Schwebende Leiste im Glas-Stil – fest am unteren Rand. */}
      <nav
        aria-label="Bereiche"
        className="glas fixed inset-x-3 bottom-[max(0.6rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-[28px] p-1"
      >
        <ul className="flex items-stretch">
          {NAV.map((n) => {
            const aktiv =
              n.href === "/privat"
                ? pfad === "/privat"
                : pfad.startsWith(n.href) || (n.href === "/privat/mehr" && pfad.startsWith("/privat/import"));
            return (
              <li key={n.href} className="flex-1">
                <Link
                  href={n.href}
                  aria-current={aktiv ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-[22px] py-1.5 text-[10.5px] font-semibold transition-colors",
                    aktiv ? "bg-surface/70 text-brand-600 shadow-[0_1px_6px_rgba(0,0,0,0.08)]" : "text-ink-muted hover:text-ink",
                  )}
                >
                  <span className="relative">
                    <n.icon className="h-[22px] w-[22px]" strokeWidth={aktiv ? 2.2 : 1.8} />
                    {n.href === "/privat/todos" && todoZahl ? (
                      <span
                        aria-label={`${todoZahl} offen`}
                        className="tnum absolute -right-2.5 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-crit-dot px-1 text-[10.5px] font-bold leading-none text-white"
                      >
                        {todoZahl > 99 ? "99+" : todoZahl}
                      </span>
                    ) : null}
                  </span>
                  {n.text}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Seitenkopf: großer Titel, optional Zeile darunter und Knöpfe rechts. */
export function PrivatKopf({ titel, unter, rechts }: { titel: ReactNode; unter?: ReactNode; rechts?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 pb-3">
      <div className="min-w-0">
        <h1 className="truncate text-[28px] font-bold leading-tight tracking-tight">{titel}</h1>
        {unter ? <div className="mt-0.5 text-[14px] text-ink-muted">{unter}</div> : null}
      </div>
      {rechts ? <div className="flex shrink-0 items-center gap-1.5 pt-1">{rechts}</div> : null}
    </header>
  );
}

/** Runde Knopf-Fläche wie im Kalender. */
export function RundKnopf({
  label,
  onClick,
  aktiv,
  children,
}: {
  label: string;
  onClick: () => void;
  aktiv?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={aktiv}
      title={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-inset transition-colors",
        aktiv ? "bg-brand-500 text-white ring-brand-500" : "glas text-ink-muted ring-transparent hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Weiße Karte mit Überschrift – wie in der Auswertung. */
export function PrivatKarte({ titel, children, className }: { titel?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("glas overflow-hidden rounded-[22px]", className)}>
      {titel ? <h2 className="glas-linie border-b px-4 py-3 text-center text-[16px] font-semibold">{titel}</h2> : null}
      {children}
    </section>
  );
}
