"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BarChart3, CalendarDays, Ellipsis, Layers, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/privat", text: "Kalender", icon: CalendarDays },
  { href: "/privat/auswertung", text: "Auswertung", icon: BarChart3 },
  { href: "/privat/teilen", text: "Teilen", icon: Users },
  { href: "/privat/schichten", text: "Schichten", icon: Layers },
  { href: "/privat/mehr", text: "Mehr", icon: Ellipsis },
];

/** Rahmen des Privatbereichs: Inhalt und Leiste unten – auf jeder Bildschirmgröße. */
export function PrivatRahmen({ children }: { children: ReactNode }) {
  const pfad = usePathname();
  return (
    <div className="min-h-dvh bg-surface-muted">
      <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        {children}
      </main>
      {/* Schwebende Leiste im Glas-Stil – fest am unteren Rand. */}
      <nav
        aria-label="Bereiche"
        className="fixed inset-x-3 bottom-[max(0.6rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-[26px] border border-line/60 bg-surface/70 p-1 shadow-[0_10px_34px_rgba(0,0,0,0.16)] backdrop-blur-2xl backdrop-saturate-150"
      >
        <ul className="flex items-stretch">
          {NAV.map((n) => {
            const aktiv = n.href === "/privat" ? pfad === "/privat" : pfad.startsWith(n.href);
            return (
              <li key={n.href} className="flex-1">
                <Link
                  href={n.href}
                  aria-current={aktiv ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-[22px] py-1.5 text-[10.5px] font-semibold transition-colors",
                    aktiv ? "bg-ink/[0.07] text-brand-600" : "text-ink-muted hover:text-ink",
                  )}
                >
                  <n.icon className="h-[22px] w-[22px]" strokeWidth={aktiv ? 2.2 : 1.8} />
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
        aktiv ? "bg-brand-500 text-white ring-brand-500" : "bg-surface/80 text-ink-muted ring-line/60 backdrop-blur-xl hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Weiße Karte mit Überschrift – wie in der Auswertung. */
export function PrivatKarte({ titel, children, className }: { titel?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-[18px] border border-line/70 bg-surface", className)}>
      {titel ? <h2 className="border-b border-line px-4 py-3 text-center text-[16px] font-semibold">{titel}</h2> : null}
      {children}
    </section>
  );
}
