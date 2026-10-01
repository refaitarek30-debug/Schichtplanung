"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSession } from "@/context/session";
import { navForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { role, company, mode } = useSession();
  const groups = navForRole(role);
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
        "hidden shrink-0 border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col",
        eingeklappt ? "w-16" : "w-64",
      )}
    >
      <Link
        href="/dashboard"
        aria-label="Schichtplan – Startseite"
        className={cn(
          "flex h-16 items-center gap-2.5 border-b border-line hover:bg-surface-muted",
          eingeklappt ? "justify-center px-2" : "px-5",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-[13px] font-bold text-white">
          SP
        </span>
        {eingeklappt ? null : (
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-semibold tracking-tight">Schichtplan</span>
            <span className="block truncate text-[11px] text-ink-faint">{company.name}</span>
          </span>
        )}
      </Link>

      <nav className={cn("flex-1 overflow-y-auto py-4", eingeklappt ? "px-2" : "px-3")}>
        {groups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            {eingeklappt ? (
              <div className="mx-2 mb-2 border-t border-line" aria-hidden />
            ) : (
              <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={eingeklappt ? item.label : undefined}
                      aria-label={eingeklappt ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors",
                        eingeklappt && "justify-center",
                        active
                          ? "bg-brand-50 font-medium text-brand-700"
                          : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                      {eingeklappt ? null : item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {eingeklappt ? null : (
        <div className="border-t border-line px-5 py-3">
          <p className="truncate text-[12px] font-medium">{company.name}</p>
          <p className="text-[11px] text-ink-faint">
            {mode === "demo" ? "Demo-Modus – ohne Backend" : "Angemeldet"}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={umschalten}
        aria-label={eingeklappt ? "Menü ausklappen" : "Menü einklappen"}
        title={eingeklappt ? "Menü ausklappen" : "Menü einklappen"}
        className={cn(
          "flex items-center gap-2 border-t border-line py-2.5 text-[12px] text-ink-muted hover:bg-surface-muted hover:text-ink",
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
