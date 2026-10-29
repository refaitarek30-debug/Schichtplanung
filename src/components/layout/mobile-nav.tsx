"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarOff, Megaphone, Menu, Users, X } from "lucide-react";
import { useSession } from "@/context/session";
import { TodoZahlMarke } from "@/components/kalender/todo-zaehler";
import { navForRole, navItems } from "@/lib/nav";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NeuMarke } from "./neu-marke";
import { useBegriffe } from "@/lib/begriffe";

/**
 * Große Kacheln oben in „Mehr“ für die Führung – die Dinge des
 * Tagesgeschäfts. Nur Wege zu bestehenden Seiten: was jemand dort darf,
 * entscheiden weiter die Seiten selbst und die Datenbank.
 */
function fuehrungsKacheln(role: Role) {
  return [
    {
      href: "/verwaltung",
      titel: "Team",
      text: "Mitarbeiter, Gruppen, AF & V-Tage",
      icon: Users,
      farbe: "bg-brand-50 text-brand-700",
    },
    {
      href: "/mitteilungen?bereich=sperren",
      titel: "Urlaubssperre",
      // Sperren anlegen darf nur die Administration (wie bisher).
      text: role === "admin" ? "Zeiträume sperren" : "Gesperrte Zeiten ansehen",
      icon: CalendarOff,
      farbe: "bg-crit-bg text-crit-fg",
    },
    {
      href: "/mitteilungen",
      titel: "Mitteilungen",
      text: "An eine Person oder an alle",
      icon: Megaphone,
      farbe: "bg-warn-bg text-warn-fg",
    },
  ];
}

/**
 * Diese Seiten stehen schon woanders: als Kachel oben (AF & V-Tage liegt
 * unter Team) oder als Reiter im Plan (Besetzung, Ausbildung).
 */
const ANDERS_ERREICHBAR = new Set(["/verwaltung", "/mitteilungen", "/altersfreizeit", "/besetzung", "/ausbildung"]);

/** Untere Tab-Leiste mit den vier Hauptbereichen plus „Mehr“ für den Rest. */
export function MobileNav() {
  const t = useBegriffe();
  const pathname = usePathname();
  const { role, profile } = useSession();
  const [open, setOpen] = useState(false);

  const primary = navItems.filter((i) => i.primary && i.roles.includes(role));
  const fuehrung = role === "shift_leader" || role === "admin";
  const kacheln = fuehrung ? fuehrungsKacheln(role) : [];
  const groups = navForRole(role, profile.protokoll === true)
    .map((g) => ({ ...g, items: fuehrung ? g.items.filter((i) => !ANDERS_ERREICHBAR.has(i.href)) : g.items }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-ink/30"
            aria-label="Menü schließen"
            onClick={() => setOpen(false)}
          />
          <div
            data-mehr
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-surface p-5 pb-24 shadow-pop"
          >
            {/* Auf dem iPad nicht über die ganze Breite gezogen. */}
            <div className="mx-auto max-w-xl">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[17px] font-semibold">Mehr</p>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted"
                  aria-label="Menü schließen"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {kacheln.length ? (
                // Handy: Team über die ganze Breite, darunter zwei nebeneinander –
                // drei in einer Reihe wären für „Urlaubssperre“ zu schmal.
                // iPad: drei in einer Reihe.
                <div data-mehr-kacheln className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {kacheln.map((k, i) => {
                    const Icon = k.icon;
                    const breit = i === 0;
                    return (
                      <Link
                        key={k.titel}
                        href={k.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex rounded-[18px] border border-line bg-surface-muted/50 p-3.5 hover:bg-surface-muted sm:min-h-[118px] sm:flex-col sm:items-start sm:gap-0",
                          breit ? "col-span-2 items-center gap-3 sm:col-span-1" : "min-h-[112px] flex-col",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:mb-2",
                            !breit && "mb-2",
                            k.farbe,
                          )}
                        >
                          <Icon className="h-5 w-5" strokeWidth={1.9} />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="text-[15px] font-semibold leading-tight">{k.titel}</span>
                          <span className="mt-0.5 text-[12px] leading-snug text-ink-muted">{t(k.text)}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
              {groups.map((group) => (
                <div key={group.label} className="mb-4 last:mb-0">
                  <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                    {group.label}
                  </p>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                              pathname === item.href
                                ? "bg-brand-50 font-medium text-brand-700"
                                : "text-ink-muted",
                            )}
                          >
                            <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                            {t(item.label)}
                            {item.neu ? <NeuMarke name={item.neu} /> : null}
                            {item.todoZahl ? <TodoZahlMarke pfad={pathname} className="ml-auto" /> : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/*
        Die Leiste liegt am unteren Rand des SICHTBAREN Fensters, nicht am
        Ende der Seite. `pb-[env(safe-area-inset-bottom)]` schiebt sie auf
        iPhones über den Home-Balken – ohne das sitzt sie teils darunter und
        wirkt, als rutsche sie ins Bild.
      */}
      <nav
        data-mobile-nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        style={{ position: "fixed" }}
      >
        <ul className="mx-auto flex max-w-lg items-stretch">
          {primary.map((item) => {
            const Icon = item.icon;
            // Besetzung und Ausbildung sind Reiter im Plan – dann leuchtet „Plan“.
            const active =
              pathname === item.href || (item.href === "/schichtplan" && (pathname === "/besetzung" || pathname === "/ausbildung"));
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px]",
                    active ? "text-brand-600" : "text-ink-faint",
                  )}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                    {item.neu ? (
                      <NeuMarke name={item.neu} className="absolute -right-4 -top-1.5" />
                    ) : null}
                    {item.todoZahl ? <TodoZahlMarke pfad={pathname} className="absolute -right-3 -top-1.5" /> : null}
                  </span>
                  {item.short ?? item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              onClick={() => setOpen(true)}
              className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] text-ink-faint"
            >
              <Menu className="h-5 w-5" strokeWidth={1.8} />
              Mehr
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
