"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSession } from "@/context/session";
import { TodoZahlMarke } from "@/components/kalender/todo-zaehler";
import { leisteAktiv, leisteFuerRolle } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { NeuMarke } from "./neu-marke";
import { useOffeneEntscheidungen } from "./urlaub-reiter";
import { useBegriffe } from "@/lib/begriffe";
import { KontoMenue } from "./konto-menue";

export function Sidebar() {
  const t = useBegriffe();
  const pathname = usePathname();
  const { role, company, mode, profile } = useSession();
  // Wenige Bereiche, unter jedem klein, was drinsteckt (Plan, Urlaub und
  // Team fassen mehrere Seiten zusammen – die Reiter stehen dort oben).
  const groups = leisteFuerRolle(role, profile.protokoll === true);
  const offen = useOffeneEntscheidungen();
  /**
   * Eingeklappt bleiben nur die Symbole – der Schichtplan bekommt die
   * Breite. Die Wahl gilt pro Gerät und bleibt beim nächsten Besuch.
   */
  const [eingeklappt, setEingeklappt] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEingeklappt(window.localStorage.getItem("seitenleiste-eingeklappt") === "1");
    } catch {
      // ohne Speicher bleibt die Leiste offen
    }
  }, []);
  function umschalten() {
    setEingeklappt((bisher) => {
      const neu = !bisher;
      try {
        window.localStorage.setItem("seitenleiste-eingeklappt", neu ? "1" : "0");
      } catch {
        // egal – gilt dann nur bis zum Neuladen
      }
      return neu;
    });
  }

  return (
    <aside
      className={cn(
        // Entwurf B: dunkle Leiste in hellem und dunklem Farbschema gleich.
        "hidden shrink-0 border-r border-white/5 bg-[#18181b] text-zinc-300 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col",
        eingeklappt ? "w-16" : "w-64",
      )}
    >
      <Link
        href="/dashboard"
        aria-label="ShiftNexo – Startseite"
        className={cn(
          "flex h-16 items-center gap-2.5 border-b border-white/10 hover:bg-white/5",
          eingeklappt ? "justify-center px-2" : "px-5",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-[13px] font-bold text-white">
          SN
        </span>
        {eingeklappt ? null : (
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-semibold tracking-tight text-white">ShiftNexo</span>
            <span className="block truncate text-[11px] text-zinc-400">{company.name}</span>
          </span>
        )}
      </Link>

      <nav className={cn("flex-1 overflow-y-auto py-4", eingeklappt ? "px-2" : "px-3")}>
        {groups.map((group, i) => (
          <div key={group.label ?? `g${i}`} className="mb-5 last:mb-0">
            {eingeklappt ? (
              i > 0 ? <div className="mx-2 mb-2 border-t border-white/10" aria-hidden /> : null
            ) : group.label ? (
              <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {group.label}
              </p>
            ) : i > 0 ? (
              <div className="mx-2.5 mb-3 border-t border-white/10" aria-hidden />
            ) : null}
            <ul className="space-y-0.5">
              {group.eintraege.map((item) => {
                const active = leisteAktiv(item, pathname);
                const Icon = item.icon;
                const zahl = item.offeneAntraege ? offen : 0;
                return (
                  <li key={`${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={eingeklappt ? t(item.label) : undefined}
                      aria-label={eingeklappt ? t(item.label) : undefined}
                      data-leiste={item.label}
                      className={cn(
                        "relative flex gap-2.5 rounded-xl px-2.5 py-2 transition-colors",
                        eingeklappt ? "items-center justify-center" : "items-start",
                        active
                          ? "bg-[#27272a] text-white"
                          : "text-zinc-400 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", !eingeklappt && "mt-0.5")} strokeWidth={1.8} />
                      {eingeklappt ? null : (
                        <span className="min-w-0 flex-1">
                          <span className={cn("flex items-center gap-1.5 text-sm", active ? "font-semibold" : "font-medium text-zinc-200")}>
                            {t(item.label)}
                            {item.neu ? <NeuMarke name={item.neu} /> : null}
                          </span>
                          <span className="mt-0.5 block text-[11.5px] leading-snug text-zinc-500">{t(item.unter)}</span>
                        </span>
                      )}
                      {zahl > 0 ? (
                        <span
                          className={cn(
                            "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-crit-dot px-1.5 text-[11px] font-bold text-white",
                            eingeklappt ? "absolute -right-0.5 -top-0.5 scale-90" : "mt-0.5",
                          )}
                          aria-label={`${zahl} offene Anträge`}
                        >
                          {zahl}
                        </span>
                      ) : null}
                      {item.todoZahl ? (
                        <TodoZahlMarke pfad={pathname} className={eingeklappt ? "absolute -right-0.5 -top-0.5 scale-75" : "mt-0.5"} />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {mode === "demo" && !eingeklappt ? <p className="px-5 pb-2 text-[11px] text-zinc-500">Demo-Modus – ohne Backend</p> : null}
      <KontoMenue eingeklappt={eingeklappt} />
      <button
        type="button"
        onClick={umschalten}
        aria-label={eingeklappt ? "Menü ausklappen" : "Menü einklappen"}
        title={eingeklappt ? "Menü ausklappen" : "Menü einklappen"}
        className={cn(
          "flex items-center gap-2 border-t border-white/10 py-2.5 text-[12px] text-zinc-400 hover:bg-white/5 hover:text-white",
          eingeklappt ? "justify-center px-2" : "px-5",
        )}
      >
        {eingeklappt ? (
          <PanelLeftOpen className="h-4 w-4" strokeWidth={1.8} />
        ) : (
          <>
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.8} />
            Menü einklappen
          </>
        )}
      </button>
    </aside>
  );
}
