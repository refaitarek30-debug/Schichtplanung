"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { useSession } from "@/context/session";
import { TodoZahlMarke } from "@/components/kalender/todo-zaehler";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { NeuMarke } from "./neu-marke";
import { MehrBlatt } from "./mehr-blatt";

/** Untere Tab-Leiste mit den vier Hauptbereichen plus „Mehr“ für den Rest. */
export function MobileNav() {
  const pathname = usePathname();
  const { role } = useSession();
  const [open, setOpen] = useState(false);

  const primary = navItems.filter((i) => i.primary && i.roles.includes(role));

  return (
    <>
      {open ? <MehrBlatt onClose={() => setOpen(false)} /> : null}

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
            // Reiter: Besetzung und Ausbildung gehören zum Plan, Entscheiden zum Urlaub.
            const active =
              pathname === item.href ||
              (item.href === "/schichtplan" && (pathname === "/besetzung" || pathname === "/ausbildung")) ||
              (item.href === "/urlaub" && pathname === "/urlaubsantraege");
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
